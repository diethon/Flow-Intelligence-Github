import { type Request, type Response } from "express";
import mongoose from "mongoose";
import { Repository } from "../models/Repository.js";
import { MetricSnapshot } from "../models/MetricSnapshot.js";
import { calculateUC10Metrics, persistUC10Snapshots } from "../services/metricsEngine.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function calculateUC10MetricsPrev(
  repositoryId: string,
  windowDays: number,
  startDate?: Date,
  endDate?: Date
): Promise<ReturnType<typeof calculateUC10Metrics> extends Promise<infer T> ? T : never> {
  const { calculateUC10Metrics: calc } = await import("../services/metricsEngine.js");
  const { PullRequest: PR } = await import("../models/PullRequest.js");
  const { Review: Rev } = await import("../models/Review.js");
  const { CheckRun: CR } = await import("../models/CheckRun.js");

  const repoObjectId = new mongoose.Types.ObjectId(repositoryId);
  const prevWindowEnd = endDate || new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const prevWindowStart = startDate || new Date(prevWindowEnd.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const durationDays = Math.round((prevWindowEnd.getTime() - prevWindowStart.getTime()) / (1000 * 60 * 60 * 24)) || windowDays;

  return calc(repositoryId, durationDays, prevWindowStart, prevWindowEnd).then((doubled) => ({
    ...doubled,
    windowStart: prevWindowStart,
    windowEnd: prevWindowEnd,
    _isPreviousPeriod: true,
  })) as ReturnType<typeof calc>;
}

interface MetricComparison {
  metric: string;
  current: number | null;
  previous: number | null;
  delta: number | null;
  deltaDirection: "up" | "down" | "same" | "no_data";
  unit: string;
}

function buildComparison(
  current: Awaited<ReturnType<typeof calculateUC10Metrics>>,
  previous: Awaited<ReturnType<typeof calculateUC10Metrics>>
): MetricComparison[] {
  const compare = (
    metric: string,
    curr: number | null,
    prev: number | null,
    unit: string,
    lowerIsBetter = true
  ): MetricComparison => {
    if (curr === null || prev === null) {
      return { metric, current: curr, previous: prev, delta: null, deltaDirection: "no_data", unit };
    }
    const delta = Math.round((curr - prev) * 10) / 10;
    const deltaDirection =
      delta === 0 ? "same" : lowerIsBetter ? (delta < 0 ? "down" : "up") : delta > 0 ? "up" : "down";
    return { metric, current: curr, previous: prev, delta, deltaDirection, unit };
  };

  return [
    compare("Review Pickup Time (avg)", current.reviewPickup.avgHours, previous.reviewPickup.avgHours, "hours"),
    compare("Review Turnaround Time (avg)", current.reviewTurnaround.avgHours, previous.reviewTurnaround.avgHours, "hours"),
    compare("Review Load Concentration", current.reviewLoadConcentration.topReviewerPct, previous.reviewLoadConcentration.topReviewerPct, "%"),
    compare("Failed Check Rate", current.failedCheckRate.failedRatePct, previous.failedCheckRate.failedRatePct, "%"),
  ];
}

// ─── Controller Methods ───────────────────────────────────────────────────────
import { GitHubConnection } from "../models/GitHubConnection.js";

export class MetricsController {
  
  // List all repositories
  async getRepositories(req: Request & { userId?: string }, res: Response): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const connections = await GitHubConnection.find({ userId }).select("_id").lean();
      const connectionIds = connections.map(c => c._id);

      const repos = await Repository.find({ connectionId: { $in: connectionIds } }).select("_id owner name fullName lastSyncedAt").lean();
      res.json({ repositories: repos });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch repositories", detail: String(err) });
    }
  }

  // Calculate and return review + CI metrics
  async calculateMetrics(req: Request, res: Response): Promise<void> {
    try {
      const repoId = String(req.params["repoId"]);
      const rawWindowDays = Number(String(req.query["windowDays"] ?? "7"));
      const windowDays = rawWindowDays === 0 ? 0 : Math.min(Math.max(rawWindowDays || 7, 1), 365);

      const repo = await Repository.findById(repoId).lean();
      if (!repo) {
        res.status(404).json({ error: "Repository not found" });
        return;
      }

      let startDate: Date | undefined;
      let endDate: Date | undefined;
      if (req.query["startDate"] && req.query["endDate"]) {
        const s = new Date(String(req.query["startDate"]));
        const e = new Date(String(req.query["endDate"]));
        if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
          startDate = s;
          endDate = e;
        }
      }

      const metrics = await calculateUC10Metrics(repoId, windowDays, startDate, endDate);
      res.json({ success: true, data: metrics });
    } catch (err) {
      res.status(500).json({ error: "Failed to calculate metrics", detail: String(err) });
    }
  }

  // Calculate and PERSIST review + CI metrics
  async calculateAndPersistMetrics(req: Request, res: Response): Promise<void> {
    try {
      const repoId = String(req.params["repoId"]);
      const rawWindowDays = Number(req.body?.windowDays ?? 7);
      const windowDays = rawWindowDays === 0 ? 0 : Math.min(Math.max(rawWindowDays || 7, 1), 365);

      const repo = await Repository.findById(repoId).lean();
      if (!repo) {
        res.status(404).json({ error: "Repository not found" });
        return;
      }

      let startDate: Date | undefined;
      let endDate: Date | undefined;
      if (req.body?.startDate && req.body?.endDate) {
        const s = new Date(String(req.body.startDate));
        const e = new Date(String(req.body.endDate));
        if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
          startDate = s;
          endDate = e;
        }
      }

      const metrics = await calculateUC10Metrics(repoId, windowDays, startDate, endDate);
      await persistUC10Snapshots(metrics);

      await Repository.findByIdAndUpdate(repoId, { lastSyncedAt: new Date() });

      res.json({
        success: true,
        message: "Review and CI metrics calculated and stored",
        data: metrics,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to calculate and persist metrics", detail: String(err) });
    }
  }

  // Get stored metric snapshots for a repository
  async getSnapshots(req: Request, res: Response): Promise<void> {
    try {
      const repoId = String(req.params["repoId"]);
      const keysParam = req.query["keys"];
      const metricKeys = keysParam ? String(keysParam).split(",") : undefined;

      const filter: Record<string, unknown> = {
        repositoryId: new mongoose.Types.ObjectId(repoId),
      };
      if (metricKeys) filter["metricKey"] = { $in: metricKeys };

      const snapshots = await MetricSnapshot.find(filter).sort({ computedAt: -1 }).lean();
      res.json({ success: true, data: snapshots });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch metric snapshots", detail: String(err) });
    }
  }

  // Compare current 7d window vs previous 7d window
  async getComparison(req: Request, res: Response): Promise<void> {
    try {
      const repoId = String(req.params["repoId"]);
      const rawWindowDays = Number(String(req.query["windowDays"] ?? "7"));
      const windowDays = rawWindowDays === 0 ? 0 : Math.min(Math.max(rawWindowDays || 7, 1), 365);

      const repo = await Repository.findById(repoId).lean();
      if (!repo) {
        res.status(404).json({ error: "Repository not found" });
        return;
      }

      let startDate: Date | undefined;
      let endDate: Date | undefined;
      let prevStartDate: Date | undefined;
      let prevEndDate: Date | undefined;

      if (req.query["startDate"] && req.query["endDate"]) {
        const s = new Date(String(req.query["startDate"]));
        const e = new Date(String(req.query["endDate"]));
        if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
          startDate = s;
          endDate = e;
          const diffMs = e.getTime() - s.getTime();
          prevEndDate = s;
          prevStartDate = new Date(s.getTime() - diffMs);
        }
      }

      const [current, previous] = await Promise.all([
        calculateUC10Metrics(repoId, windowDays, startDate, endDate),
        calculateUC10MetricsPrev(repoId, windowDays, prevStartDate, prevEndDate),
      ]);

      const comparison = buildComparison(current, previous);
      res.json({ success: true, data: { current, previous, comparison } });
    } catch (err) {
      res.status(500).json({ error: "Failed to calculate comparison", detail: String(err) });
    }
  }
}

export const metricsController = new MetricsController();
