import mongoose from "mongoose";
import { PullRequest } from "../models/PullRequest.js";
import { MetricSnapshot, type MetricKey } from "../models/MetricSnapshot.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PRMetricsResult {
  repositoryId: string;
  windowStart: Date;
  windowEnd: Date;
  openPRCount: number;
  stalePRCount: number;
  stalePRIds: { prNumber: number; title: string; daysOpen: number }[];
  oversizedPRCount: number;
  oversizedPRIds: { prNumber: number; title: string; totalLines: number }[];
  cycleTimeAvgHours: number | null;
  cycleTimeMedianHours: number | null;
  mergeTimeAvgHours: number | null;
  cycleTimeSampleSize: number;
  dataStatus: "ok" | "insufficient_data" | "partial";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hoursApart(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// ─── Core Calculation ─────────────────────────────────────────────────────────

const STALE_THRESHOLD_DAYS = 5;
const OVERSIZED_THRESHOLD_LINES = 500;

export async function calculatePRMetrics(
  repositoryId: string,
  windowDays: number = 7,
  startDate?: Date,
  endDate?: Date
): Promise<PRMetricsResult> {
  const repoId = new mongoose.Types.ObjectId(repositoryId);
  const windowEnd = endDate || new Date();
  const windowStart = startDate || (windowDays === 0 ? new Date(0) : new Date(windowEnd.getTime() - windowDays * 24 * 60 * 60 * 1000));

  const prs = await PullRequest.find({
    repositoryId: repoId,
    $or: [
      { createdAt: { $gte: windowStart, $lte: windowEnd } },
      { state: "open" }
    ]
  }).lean();

  const now = new Date();

  // Open PR count
  const openPRs = prs.filter((p) => p.state === "open");

  // Stale PRs: open for > STALE_THRESHOLD_DAYS days with no merge
  const stalePRs = prs.filter((p) => {
    if (p.state !== "open") return false;
    const daysOpen = hoursApart(p.createdAt, now) / 24;
    return daysOpen > STALE_THRESHOLD_DAYS;
  });

  const stalePRIds = stalePRs.map((p) => ({
    prNumber: p.number,
    title: p.title,
    daysOpen: Math.round(hoursApart(p.createdAt, now) / 24),
  }));

  // Oversized PRs: additions + deletions > OVERSIZED_THRESHOLD_LINES
  const oversizedPRs = prs.filter((p) => p.additions + p.deletions > OVERSIZED_THRESHOLD_LINES);
  const oversizedPRIds = oversizedPRs.map((p) => ({
    prNumber: p.number,
    title: p.title,
    totalLines: p.additions + p.deletions,
  }));

  // PR Cycle time: createdAt → mergedAt for merged PRs in window
  const mergedPRs = prs.filter((p) => p.state === "merged" && p.mergedAt !== null);
  const cycleTimesHours = mergedPRs.map((p) => hoursApart(p.createdAt, p.mergedAt!));
  const mergeTimesHours = mergedPRs.map((p) =>
    p.readyForReviewAt ? hoursApart(p.readyForReviewAt, p.mergedAt!) : hoursApart(p.createdAt, p.mergedAt!)
  );

  const dataStatus =
    prs.length === 0 ? "insufficient_data" : mergedPRs.length < 3 ? "partial" : "ok";

  return {
    repositoryId,
    windowStart,
    windowEnd,
    openPRCount: openPRs.length,
    stalePRCount: stalePRs.length,
    stalePRIds,
    oversizedPRCount: oversizedPRs.length,
    oversizedPRIds,
    cycleTimeAvgHours: average(cycleTimesHours),
    cycleTimeMedianHours: median(cycleTimesHours),
    mergeTimeAvgHours: average(mergeTimesHours),
    cycleTimeSampleSize: mergedPRs.length,
    dataStatus,
  };
}

// ─── Persist PR Metric Snapshots ──────────────────────────────────────────────

export async function persistPRMetricSnapshots(result: PRMetricsResult): Promise<void> {
  const repoId = new mongoose.Types.ObjectId(result.repositoryId);
  const { windowStart, windowEnd, dataStatus } = result;

  const snapshots: Array<{ key: MetricKey; value: number | null; unit: string; size: number; meta: Record<string, unknown> }> = [
    { key: "open_pr_count", value: result.openPRCount, unit: "count", size: result.openPRCount, meta: {} },
    { key: "stale_pr_count", value: result.stalePRCount, unit: "count", size: result.stalePRCount, meta: { stalePRs: result.stalePRIds } },
    { key: "oversized_pr_count", value: result.oversizedPRCount, unit: "count", size: result.oversizedPRCount, meta: { oversizedPRs: result.oversizedPRIds } },
    { key: "pr_cycle_time_avg_hours", value: result.cycleTimeAvgHours, unit: "hours", size: result.cycleTimeSampleSize, meta: {} },
    { key: "pr_cycle_time_median_hours", value: result.cycleTimeMedianHours, unit: "hours", size: result.cycleTimeSampleSize, meta: {} },
    { key: "pr_merge_time_avg_hours", value: result.mergeTimeAvgHours, unit: "hours", size: result.cycleTimeSampleSize, meta: {} },
  ];

  await Promise.all(
    snapshots.map((s) =>
      MetricSnapshot.findOneAndUpdate(
        { repositoryId: repoId, windowStart, windowEnd, metricKey: s.key },
        {
          $set: {
            repositoryId: repoId,
            metricKey: s.key,
            value: s.value,
            unit: s.unit,
            windowStart,
            windowEnd,
            dataStatus,
            sampleSize: s.size,
            computedAt: new Date(),
            metadata: s.meta,
          },
        },
        { upsert: true, new: true }
      )
    )
  );
}
