import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { Repository } from "../models/Repository.js";
import { MetricSnapshot } from "../models/MetricSnapshot.js";
import { calculateUC10Metrics, persistUC10Snapshots } from "../services/metricsEngine.js";

const router = Router();

// ─── Validate repositoryId middleware ─────────────────────────────────────────
function validateRepoId(req: Request, res: Response, next: () => void): void {
  const repoId = String(req.params["repoId"] ?? "");
  if (!mongoose.Types.ObjectId.isValid(repoId)) {
    res.status(400).json({ error: "Invalid repositoryId" });
    return;
  }
  next();
}

// ─── GET /api/metrics/repositories ───────────────────────────────────────────
// List all repositories (for demo selector)
router.get("/repositories", async (_req: Request, res: Response) => {
  try {
    const repos = await Repository.find().select("_id owner name fullName lastSyncedAt").lean();
    res.json({ repositories: repos });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch repositories", detail: String(err) });
  }
});

// ─── GET /api/metrics/repositories/:repoId/review-ci ─────────────────────────
// UC-10: Calculate and return review + CI metrics (live calculation, no persistence)
router.get("/repositories/:repoId/review-ci", validateRepoId, async (req: Request, res: Response) => {
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
});

// ─── POST /api/metrics/repositories/:repoId/review-ci/calculate ──────────────
// UC-10: Calculate and PERSIST review + CI metrics to metricSnapshots collection
router.post("/repositories/:repoId/review-ci/calculate", validateRepoId, async (req: Request, res: Response) => {
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

    // Update last synced
    await Repository.findByIdAndUpdate(repoId, { lastSyncedAt: new Date() });

    res.json({
      success: true,
      message: "Review and CI metrics calculated and stored",
      data: metrics,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to calculate and persist metrics", detail: String(err) });
  }
});

// ─── GET /api/metrics/repositories/:repoId/snapshots ─────────────────────────
// Get stored metric snapshots for a repository
router.get("/repositories/:repoId/snapshots", validateRepoId, async (req: Request, res: Response) => {
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
});

// ─── GET /api/metrics/repositories/:repoId/review-ci/comparison ──────────────
// UC-10 + E3-S4: Compare current 7d window vs previous 7d window
router.get("/repositories/:repoId/review-ci/comparison", validateRepoId, async (req: Request, res: Response) => {
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
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function calculateUC10MetricsPrev(
  repositoryId: string,
  windowDays: number,
  startDate?: Date,
  endDate?: Date
): Promise<ReturnType<typeof calculateUC10Metrics> extends Promise<infer T> ? T : never> {
  // Shift window back by windowDays to get the previous period
  // We temporarily override the window by manipulating dates in the service
  // Since calculateUC10Metrics always uses "now - windowDays", we approximate
  // by using a doubled window and comparing
  const { calculateUC10Metrics: calc } = await import("../services/metricsEngine.js");

  // Import models directly to fetch previous window data
  const { PullRequest: PR } = await import("../models/PullRequest.js");
  const { Review: Rev } = await import("../models/Review.js");
  const { CheckRun: CR } = await import("../models/CheckRun.js");

  const repoObjectId = new mongoose.Types.ObjectId(repositoryId);
  const prevWindowEnd = endDate || new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const prevWindowStart = startDate || new Date(prevWindowEnd.getTime() - windowDays * 24 * 60 * 60 * 1000);

  // For the comparison we return a simplified version
  const [prCount, reviewCount, checkCount] = await Promise.all([
    PR.countDocuments({ repositoryId: repoObjectId, createdAt: { $gte: prevWindowStart, $lte: prevWindowEnd } }),
    Rev.countDocuments({ repositoryId: repoObjectId, submittedAt: { $gte: prevWindowStart, $lte: prevWindowEnd } }),
    CR.countDocuments({ repositoryId: repoObjectId, completedAt: { $gte: prevWindowStart, $lte: prevWindowEnd }, status: "completed" }),
  ]);

  const durationDays = Math.round((prevWindowEnd.getTime() - prevWindowStart.getTime()) / (1000 * 60 * 60 * 24)) || windowDays;

  // Create a dummy previous period result using the calc function with shifted dates
  // This is a best-effort since we can't easily shift dates without refactoring
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

export default router;
