import mongoose from "mongoose";
import { PullRequest } from "../models/PullRequest.js";
import { Review } from "../models/Review.js";
import { ReviewRequest } from "../models/ReviewRequest.js";
import { CheckRun } from "../models/CheckRun.js";
import { Contributor } from "../models/Contributor.js";
import { MetricSnapshot, type MetricKey } from "../models/MetricSnapshot.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hoursApart(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReviewPickupResult {
  avgHours: number | null;
  medianHours: number | null;
  sampleSize: number;
  dataStatus: "ok" | "insufficient_data" | "partial";
  perPR: { prNumber: number; title: string; pickupHours: number | null }[];
}

export interface ReviewTurnaroundResult {
  avgHours: number | null;
  medianHours: number | null;
  sampleSize: number;
  dataStatus: "ok" | "insufficient_data" | "partial";
  perPR: { prNumber: number; title: string; turnaroundHours: number | null }[];
}

export interface ReviewLoadConcentrationResult {
  topReviewerPct: number | null;
  concentrationIndex: number | null;
  totalReviews: number;
  reviewerBreakdown: { reviewerId: string; login: string; count: number; pct: number }[];
  dataStatus: "ok" | "insufficient_data" | "partial";
}

export interface FailedCheckRateResult {
  failedRatePct: number | null;
  totalRuns: number;
  failedRuns: number;
  successRuns: number;
  dataStatus: "ok" | "insufficient_data" | "partial";
  checkBreakdown: { name: string; total: number; failed: number; failRate: number }[];
}

export interface UC10MetricsResult {
  repositoryId: string;
  windowStart: Date;
  windowEnd: Date;
  windowDays: number;
  reviewPickup: ReviewPickupResult;
  reviewTurnaround: ReviewTurnaroundResult;
  reviewLoadConcentration: ReviewLoadConcentrationResult;
  failedCheckRate: FailedCheckRateResult;
  computedAt: Date;
}

// ─── UC-10 Core Calculation ───────────────────────────────────────────────────

/**
 * UC-10: Calculate Review and CI Metrics
 * Computes review pickup time, review turnaround time,
 * review load concentration, and failed check rate.
 */
export async function calculateUC10Metrics(
  repositoryId: string,
  windowDays: number = 7
): Promise<UC10MetricsResult> {
  const repoObjectId = new mongoose.Types.ObjectId(repositoryId);
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const [reviewPickup, reviewTurnaround, reviewLoad, failedCheck] = await Promise.all([
    calcReviewPickupTime(repoObjectId, windowStart, windowEnd),
    calcReviewTurnaroundTime(repoObjectId, windowStart, windowEnd),
    calcReviewLoadConcentration(repoObjectId, windowStart, windowEnd),
    calcFailedCheckRate(repoObjectId, windowStart, windowEnd),
  ]);

  return {
    repositoryId,
    windowStart,
    windowEnd,
    windowDays,
    reviewPickup,
    reviewTurnaround,
    reviewLoadConcentration: reviewLoad,
    failedCheckRate: failedCheck,
    computedAt: new Date(),
  };
}

// ─── Review Pickup Time ───────────────────────────────────────────────────────

/**
 * Review pickup time = time from PR ready-for-review to first review submitted.
 * Uses PR.readyForReviewAt if set, otherwise PR.createdAt.
 */
async function calcReviewPickupTime(
  repositoryId: mongoose.Types.ObjectId,
  windowStart: Date,
  windowEnd: Date
): Promise<ReviewPickupResult> {
  const prs = await PullRequest.find({
    repositoryId,
    createdAt: { $gte: windowStart, $lte: windowEnd },
    isDraft: false,
  }).lean();

  if (prs.length === 0) {
    return { avgHours: null, medianHours: null, sampleSize: 0, dataStatus: "insufficient_data", perPR: [] };
  }

  const pickupHoursArr: number[] = [];
  const perPR: ReviewPickupResult["perPR"] = [];

  for (const pr of prs) {
    const startTime = pr.readyForReviewAt ?? pr.createdAt;
    const firstReview = await Review.findOne({
      pullRequestId: pr._id,
    })
      .sort({ submittedAt: 1 })
      .lean();

    const pickupHours = firstReview ? hoursApart(startTime, firstReview.submittedAt) : null;
    perPR.push({ prNumber: pr.number, title: pr.title, pickupHours });
    if (pickupHours !== null) pickupHoursArr.push(pickupHours);
  }

  const hasPartialData = perPR.some((p) => p.pickupHours === null) && pickupHoursArr.length > 0;

  return {
    avgHours: average(pickupHoursArr),
    medianHours: median(pickupHoursArr),
    sampleSize: pickupHoursArr.length,
    dataStatus: pickupHoursArr.length === 0 ? "insufficient_data" : hasPartialData ? "partial" : "ok",
    perPR,
  };
}

// ─── Review Turnaround Time ───────────────────────────────────────────────────

/**
 * Review turnaround time = time from earliest review request to last review submission for each PR.
 * Falls back to PR.createdAt if no review requests exist.
 */
async function calcReviewTurnaroundTime(
  repositoryId: mongoose.Types.ObjectId,
  windowStart: Date,
  windowEnd: Date
): Promise<ReviewTurnaroundResult> {
  const prs = await PullRequest.find({
    repositoryId,
    createdAt: { $gte: windowStart, $lte: windowEnd },
    isDraft: false,
  }).lean();

  if (prs.length === 0) {
    return { avgHours: null, medianHours: null, sampleSize: 0, dataStatus: "insufficient_data", perPR: [] };
  }

  const turnaroundArr: number[] = [];
  const perPR: ReviewTurnaroundResult["perPR"] = [];

  for (const pr of prs) {
    const [earliestRequest, lastReview] = await Promise.all([
      ReviewRequest.findOne({ pullRequestId: pr._id }).sort({ requestedAt: 1 }).lean(),
      Review.findOne({ pullRequestId: pr._id }).sort({ submittedAt: -1 }).lean(),
    ]);

    if (!lastReview) {
      perPR.push({ prNumber: pr.number, title: pr.title, turnaroundHours: null });
      continue;
    }

    // Use earliest review request if available, else fall back to PR createdAt
    const startTime = earliestRequest ? earliestRequest.requestedAt : pr.createdAt;
    const turnaroundHours = hoursApart(startTime, lastReview.submittedAt);
    turnaroundArr.push(turnaroundHours);
    perPR.push({ prNumber: pr.number, title: pr.title, turnaroundHours });
  }

  const hasPartialData = perPR.some((p) => p.turnaroundHours === null) && turnaroundArr.length > 0;

  return {
    avgHours: average(turnaroundArr),
    medianHours: median(turnaroundArr),
    sampleSize: turnaroundArr.length,
    dataStatus: turnaroundArr.length === 0 ? "insufficient_data" : hasPartialData ? "partial" : "ok",
    perPR,
  };
}

// ─── Review Load Concentration ────────────────────────────────────────────────

/**
 * Review load concentration = % of reviews done by the top reviewer.
 * Concentration index = (top reviewer count) / total reviews * 100.
 * High value (>50%) means review bottleneck risk (R3).
 */
async function calcReviewLoadConcentration(
  repositoryId: mongoose.Types.ObjectId,
  windowStart: Date,
  windowEnd: Date
): Promise<ReviewLoadConcentrationResult> {
  const reviews = await Review.find({
    repositoryId,
    submittedAt: { $gte: windowStart, $lte: windowEnd },
  }).lean();

  if (reviews.length === 0) {
    return {
      topReviewerPct: null,
      concentrationIndex: null,
      totalReviews: 0,
      reviewerBreakdown: [],
      dataStatus: "insufficient_data",
    };
  }

  // Count reviews per reviewer
  const countMap = new Map<string, number>();
  for (const r of reviews) {
    const id = r.reviewerId.toString();
    countMap.set(id, (countMap.get(id) ?? 0) + 1);
  }

  const total = reviews.length;
  const sortedEntries = Array.from(countMap.entries()).sort((a, b) => b[1] - a[1]);

  // Fetch reviewer logins
  const reviewerIds = sortedEntries.map(([id]) => new mongoose.Types.ObjectId(id));
  const contributors = await Contributor.find({ _id: { $in: reviewerIds } })
    .select("_id login")
    .lean();
  const loginMap = new Map(contributors.map((c) => [c._id.toString(), c.login]));

  const reviewerBreakdown = sortedEntries.map(([id, count]) => ({
    reviewerId: id,
    login: loginMap.get(id) ?? "unknown",
    count,
    pct: Math.round((count / total) * 100 * 10) / 10,
  }));

  const topCount = sortedEntries[0][1];
  const topReviewerPct = Math.round((topCount / total) * 100 * 10) / 10;

  // Herfindahl-Hirschman Index (normalized) as concentration index
  const hhi = reviewerBreakdown.reduce((sum, r) => sum + (r.count / total) ** 2, 0);
  const n = reviewerBreakdown.length;
  const normalizedHHI = n > 1 ? (hhi - 1 / n) / (1 - 1 / n) : 1;
  const concentrationIndex = Math.round(normalizedHHI * 100 * 10) / 10;

  return {
    topReviewerPct,
    concentrationIndex,
    totalReviews: total,
    reviewerBreakdown,
    dataStatus: "ok",
  };
}

// ─── Failed Check Rate ────────────────────────────────────────────────────────

/**
 * Failed check rate = failed completed check runs / total completed check runs * 100.
 * Returns per-check-name breakdown for drill-down.
 */
async function calcFailedCheckRate(
  repositoryId: mongoose.Types.ObjectId,
  windowStart: Date,
  windowEnd: Date
): Promise<FailedCheckRateResult> {
  const checks = await CheckRun.find({
    repositoryId,
    status: "completed",
    completedAt: { $gte: windowStart, $lte: windowEnd },
  }).lean();

  if (checks.length === 0) {
    return {
      failedRatePct: null,
      totalRuns: 0,
      failedRuns: 0,
      successRuns: 0,
      dataStatus: "insufficient_data",
      checkBreakdown: [],
    };
  }

  const failedRuns = checks.filter((c) => c.conclusion === "failure" || c.conclusion === "timed_out").length;
  const successRuns = checks.filter((c) => c.conclusion === "success").length;
  const total = checks.length;
  const failedRatePct = Math.round((failedRuns / total) * 100 * 10) / 10;

  // Breakdown per check name
  const nameMap = new Map<string, { total: number; failed: number }>();
  for (const c of checks) {
    const existing = nameMap.get(c.name) ?? { total: 0, failed: 0 };
    existing.total++;
    if (c.conclusion === "failure" || c.conclusion === "timed_out") existing.failed++;
    nameMap.set(c.name, existing);
  }

  const checkBreakdown = Array.from(nameMap.entries())
    .map(([name, { total: t, failed: f }]) => ({
      name,
      total: t,
      failed: f,
      failRate: Math.round((f / t) * 100 * 10) / 10,
    }))
    .sort((a, b) => b.failRate - a.failRate);

  return {
    failedRatePct,
    totalRuns: total,
    failedRuns,
    successRuns,
    dataStatus: failedRuns > 0 && successRuns === 0 ? "partial" : "ok",
    checkBreakdown,
  };
}

// ─── Persist Metric Snapshots ─────────────────────────────────────────────────

/**
 * Save UC-10 metric results into the metricSnapshots collection.
 * Uses upsert to avoid duplicates.
 */
export async function persistUC10Snapshots(result: UC10MetricsResult): Promise<void> {
  const repoId = new mongoose.Types.ObjectId(result.repositoryId);
  const { windowStart, windowEnd } = result;

  const snapshots: Array<{
    key: MetricKey;
    value: number | null;
    unit: string;
    status: "ok" | "insufficient_data" | "partial";
    size: number;
    meta: Record<string, unknown>;
  }> = [
    {
      key: "review_pickup_time_avg_hours",
      value: result.reviewPickup.avgHours,
      unit: "hours",
      status: result.reviewPickup.dataStatus,
      size: result.reviewPickup.sampleSize,
      meta: {},
    },
    {
      key: "review_pickup_time_median_hours",
      value: result.reviewPickup.medianHours,
      unit: "hours",
      status: result.reviewPickup.dataStatus,
      size: result.reviewPickup.sampleSize,
      meta: {},
    },
    {
      key: "review_turnaround_time_avg_hours",
      value: result.reviewTurnaround.avgHours,
      unit: "hours",
      status: result.reviewTurnaround.dataStatus,
      size: result.reviewTurnaround.sampleSize,
      meta: {},
    },
    {
      key: "review_turnaround_time_median_hours",
      value: result.reviewTurnaround.medianHours,
      unit: "hours",
      status: result.reviewTurnaround.dataStatus,
      size: result.reviewTurnaround.sampleSize,
      meta: {},
    },
    {
      key: "review_load_concentration_pct",
      value: result.reviewLoadConcentration.concentrationIndex,
      unit: "pct",
      status: result.reviewLoadConcentration.dataStatus,
      size: result.reviewLoadConcentration.totalReviews,
      meta: { reviewerBreakdown: result.reviewLoadConcentration.reviewerBreakdown },
    },
    {
      key: "review_load_top_reviewer_pct",
      value: result.reviewLoadConcentration.topReviewerPct,
      unit: "pct",
      status: result.reviewLoadConcentration.dataStatus,
      size: result.reviewLoadConcentration.totalReviews,
      meta: { reviewerBreakdown: result.reviewLoadConcentration.reviewerBreakdown },
    },
    {
      key: "failed_check_rate_pct",
      value: result.failedCheckRate.failedRatePct,
      unit: "pct",
      status: result.failedCheckRate.dataStatus,
      size: result.failedCheckRate.totalRuns,
      meta: { checkBreakdown: result.failedCheckRate.checkBreakdown },
    },
    {
      key: "total_check_runs",
      value: result.failedCheckRate.totalRuns,
      unit: "count",
      status: result.failedCheckRate.dataStatus,
      size: result.failedCheckRate.totalRuns,
      meta: {},
    },
    {
      key: "failed_check_runs",
      value: result.failedCheckRate.failedRuns,
      unit: "count",
      status: result.failedCheckRate.dataStatus,
      size: result.failedCheckRate.totalRuns,
      meta: {},
    },
    {
      key: "total_reviews",
      value: result.reviewLoadConcentration.totalReviews,
      unit: "count",
      status: result.reviewLoadConcentration.dataStatus,
      size: result.reviewLoadConcentration.totalReviews,
      meta: {},
    },
    {
      key: "prs_with_review_count",
      value: result.reviewPickup.sampleSize,
      unit: "count",
      status: result.reviewPickup.dataStatus,
      size: result.reviewPickup.sampleSize,
      meta: {},
    },
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
            dataStatus: s.status,
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
