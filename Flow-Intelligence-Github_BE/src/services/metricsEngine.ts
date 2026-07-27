import mongoose from "mongoose";
import { PullRequest } from "../models/PullRequest.js";
import { Review } from "../models/Review.js";
import { ReviewRequest } from "../models/ReviewRequest.js";
import { CheckRun } from "../models/CheckRun.js";
import { Commit } from "../models/Commit.js";
import { Contributor } from "../models/Contributor.js";
import { MetricSnapshot, type MetricKey } from "../models/MetricSnapshot.js";
import { classifyOffHours, isBotIdentity, extractCoAuthors } from "../utils/offHours.js";

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
  windowDays: number = 7,
  startDate?: Date,
  endDate?: Date
): Promise<UC10MetricsResult> {
  const repoObjectId = new mongoose.Types.ObjectId(repositoryId);
  const windowEnd = endDate || new Date();
  const windowStart = startDate || (windowDays === 0 ? new Date(0) : new Date(windowEnd.getTime() - windowDays * 24 * 60 * 60 * 1000));
  const calculatedDays = startDate && endDate
    ? Math.round(Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    : windowDays;

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
    windowDays: calculatedDays || 1,
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

// ─── Workload Risk (Developer Burnout signal) ─────────────────────────────────

/**
 * Minimum number of distinct contributors with off-hours activity required
 * before a Workload Risk signal is surfaced. Below this, we return
 * `insufficient_data` so the aggregate cannot be traced back to an individual
 * (privacy-safe by design — no individual productivity score).
 */
export const WORKLOAD_MIN_GROUP_THRESHOLD = 3;

/** Number of representative off-hours records attached as Evidence. */
const WORKLOAD_EVIDENCE_LIMIT = 6;

export type WorkloadSeverity = "high" | "medium" | "low";

export interface WorkloadRiskAggregate {
  totalEvents: number;
  offHoursEvents: number;
  offHoursPct: number | null;
  weekendCount: number;
  nightCount: number;
  /** Total commit / review events (all hours) — the split behind totalEvents. */
  commitCount: number;
  reviewCount: number;
  /** How many of the off-hours events were commits vs reviews. */
  offHoursCommitCount: number;
  offHoursReviewCount: number;
  distinctContributorsOffHours: number;
  windowStart: Date;
  windowEnd: Date;
  dataStatus: "ok" | "insufficient_data";
}

/** Per-contributor breakdown. `label` carries the real GitHub identity. */
export interface WorkloadContributorBreakdown {
  label: string;
  /** Total commit + review events (all hours) — the denominator for off-hours. */
  totalEvents: number;
  /** Total activity split by kind (all hours). */
  commits: number;
  reviews: number;
  offHoursEvents: number;
  /** Off-hours activity split by kind. */
  offHoursCommits: number;
  offHoursReviews: number;
  weekend: number;
  night: number;
}

export interface WorkloadEvidenceRef {
  entityType: "commit" | "review";
  entityId: string;
}

export interface WorkloadRiskResult {
  repositoryId: string;
  aggregate: WorkloadRiskAggregate;
  breakdown: WorkloadContributorBreakdown[];
  evidenceRefs: WorkloadEvidenceRef[];
  severity: WorkloadSeverity;
}

interface OffHoursEvent {
  entityType: "commit" | "review";
  entityId: string;
  at: Date;
  contributorId: string | null;
  weekend: boolean;
  night: boolean;
}

/** Stable pseudonym label: "Contributor A", "Contributor B", ... */
export function pseudonymLabel(index: number): string {
  if (index < 26) return `Contributor ${String.fromCharCode(65 + index)}`;
  return `Contributor ${index + 1}`;
}

function severityFromPct(pct: number): WorkloadSeverity {
  if (pct >= 40) return "high";
  if (pct >= 20) return "medium";
  return "low";
}

/**
 * Developer Burnout / Workload Risk: scans commits and reviews in the window,
 * flags activity happening on weekends or at night (UTC), and aggregates it at
 * the team level plus a pseudonymized per-contributor breakdown.
 *
 * Privacy: no real names are ever returned; below WORKLOAD_MIN_GROUP_THRESHOLD
 * distinct contributors the result is marked `insufficient_data`.
 */
export async function calculateWorkloadRisk(
  repositoryId: string,
  windowStart: Date,
  windowEnd: Date
): Promise<WorkloadRiskResult> {
  const repoObjectId = new mongoose.Types.ObjectId(repositoryId);

  const [commits, reviews, contributors] = await Promise.all([
    Commit.find({ repositoryId: repoObjectId, committedAt: { $gte: windowStart, $lte: windowEnd } })
      .select("_id committedAt authorGithubId authorLogin message")
      .lean<
        {
          _id: mongoose.Types.ObjectId;
          committedAt: Date;
          authorGithubId?: number | null;
          authorLogin?: string | null;
          message?: string | null;
        }[]
      >(),
    Review.find({ repositoryId: repoObjectId, submittedAt: { $gte: windowStart, $lte: windowEnd } })
      .select("_id submittedAt reviewerId")
      .lean(),
    Contributor.find({ repositoryId: repoObjectId })
      .select("_id githubUserId login")
      .lean<{ _id: mongoose.Types.ObjectId; githubUserId?: number | null; login?: string | null }[]>(),
  ]);

  // Commits are stored with the author's GitHub id (not a Contributor ref),
  // while reviews carry a Contributor _id. Resolve commit authors into that same
  // identity space so someone who both commits AND reviews off-hours is counted
  // once. Authors without a Contributor record fall back to a stable `gh:<id>` key.
  const contributorIdByGithubId = new Map<number, string>();
  const nameByContributorId = new Map<string, string>();
  for (const c of contributors) {
    if (c.githubUserId != null) contributorIdByGithubId.set(c.githubUserId, c._id.toString());
    nameByContributorId.set(c._id.toString(), c.login ?? `@${c.githubUserId ?? "unknown"}`);
  }
  const commitContributorId = (githubUserId?: number | null): string | null => {
    if (githubUserId == null) return null;
    return contributorIdByGithubId.get(githubUserId) ?? `gh:${githubUserId}`;
  };
  // Commit authors often have no Contributor record (unlinked/bot accounts), so
  // remember their GitHub login to show a real name instead of a bare id.
  const loginByGithubId = new Map<number, string>();
  // Humans recovered from a bot commit's `Co-authored-by:` trailer, keyed `co:<email>`.
  const coAuthorNameByCid = new Map<string, string>();
  // Real contributor identity for the breakdown (per the project decision to
  // surface who is working off-hours).
  const displayName = (contributorId: string): string => {
    const known = nameByContributorId.get(contributorId);
    if (known) return known;
    if (contributorId.startsWith("gh:")) {
      const gid = Number(contributorId.slice(3));
      return loginByGithubId.get(gid) ?? `@${gid}`;
    }
    if (contributorId.startsWith("co:")) {
      return coAuthorNameByCid.get(contributorId) ?? contributorId.slice(3);
    }
    return contributorId;
  };

  // Detect bot / automation identities: burnout is a human signal, and a bot
  // committing every night (e.g. "actions-user") otherwise dominates the counts.
  // Detect by author login, or by a linked Contributor whose login is a bot.
  const botGithubIds = new Set<number>();
  const botContributorIds = new Set<string>();
  for (const c of contributors) {
    if (isBotIdentity(c.login)) {
      botContributorIds.add(c._id.toString());
      if (c.githubUserId != null) botGithubIds.add(c.githubUserId);
    }
  }
  const isBotCommit = (c: { authorGithubId?: number | null; authorLogin?: string | null }): boolean =>
    isBotIdentity(c.authorLogin) || (c.authorGithubId != null && botGithubIds.has(c.authorGithubId));

  // Bot reviews carry no message to recover an author from — just drop them.
  const humanReviews = reviews.filter((r) => !(r.reviewerId && botContributorIds.has(r.reviewerId.toString())));

  // Total activity per contributor (all hours: commits + reviews) so the
  // breakdown's off-hours count always has a denominator ≥ itself. Counting
  // only commits made reviewers show 0 total but non-zero off-hours.
  const totalEventsByContributor = new Map<string, number>();
  // Split totals per contributor so the UI can show "X commits, Y reviews".
  const commitsByContributor = new Map<string, number>();
  const reviewsByContributor = new Map<string, number>();

  let countedCommitEvents = 0;
  const offHoursEvents: OffHoursEvent[] = [];
  for (const c of commits) {
    let cid: string | null;
    if (isBotCommit(c)) {
      // A bot commit still credits the real human via `Co-authored-by:`. No
      // co-author → genuine automation, exclude it entirely.
      const coAuthor = extractCoAuthors(c.message)[0];
      if (!coAuthor) continue;
      cid = `co:${coAuthor.email || coAuthor.name.toLowerCase()}`;
      coAuthorNameByCid.set(cid, coAuthor.name);
    } else {
      if (c.authorGithubId != null && c.authorLogin) loginByGithubId.set(c.authorGithubId, c.authorLogin);
      cid = commitContributorId(c.authorGithubId);
    }

    countedCommitEvents++;
    if (cid) {
      totalEventsByContributor.set(cid, (totalEventsByContributor.get(cid) ?? 0) + 1);
      commitsByContributor.set(cid, (commitsByContributor.get(cid) ?? 0) + 1);
    }

    const flags = classifyOffHours(c.committedAt);
    if (!flags.offHours) continue;
    offHoursEvents.push({
      entityType: "commit",
      entityId: c._id.toString(),
      at: c.committedAt,
      contributorId: cid,
      weekend: flags.weekend,
      night: flags.night,
    });
  }

  const totalEvents = countedCommitEvents + humanReviews.length;

  for (const r of humanReviews) {
    const rid = r.reviewerId ? r.reviewerId.toString() : null;
    if (rid) {
      totalEventsByContributor.set(rid, (totalEventsByContributor.get(rid) ?? 0) + 1);
      reviewsByContributor.set(rid, (reviewsByContributor.get(rid) ?? 0) + 1);
    }

    const flags = classifyOffHours(r.submittedAt);
    if (!flags.offHours) continue;
    offHoursEvents.push({
      entityType: "review",
      entityId: r._id.toString(),
      at: r.submittedAt,
      contributorId: rid,
      weekend: flags.weekend,
      night: flags.night,
    });
  }

  const weekendCount = offHoursEvents.filter((e) => e.weekend).length;
  const nightCount = offHoursEvents.filter((e) => e.night).length;
  const offHoursCommitCount = offHoursEvents.filter((e) => e.entityType === "commit").length;
  const offHoursReviewCount = offHoursEvents.filter((e) => e.entityType === "review").length;
  const offHoursPct = totalEvents > 0 ? Math.round((offHoursEvents.length / totalEvents) * 100) : null;

  // Group by contributor (known ids only) for the pseudonymized breakdown.
  const byContributor = new Map<
    string,
    { offHoursEvents: number; offHoursCommits: number; offHoursReviews: number; weekend: number; night: number }
  >();
  for (const e of offHoursEvents) {
    if (!e.contributorId) continue;
    const acc =
      byContributor.get(e.contributorId) ??
      { offHoursEvents: 0, offHoursCommits: 0, offHoursReviews: 0, weekend: 0, night: 0 };
    acc.offHoursEvents += 1;
    if (e.entityType === "commit") acc.offHoursCommits += 1;
    else acc.offHoursReviews += 1;
    if (e.weekend) acc.weekend += 1;
    if (e.night) acc.night += 1;
    byContributor.set(e.contributorId, acc);
  }

  const distinctContributorsOffHours = byContributor.size;
  const insufficient = totalEvents === 0 || distinctContributorsOffHours < WORKLOAD_MIN_GROUP_THRESHOLD;

  // Per-contributor breakdown with real identity + total vs off-hours commits.
  // Built from EVERY contributor with attributable activity (not just those with
  // off-hours events) so the table reconciles with the aggregate totals — a person
  // who only worked in-hours still shows up with their commits/reviews and 0 off-
  // hours, instead of silently dropping their (in-hours) commits from the table.
  const NO_OFF_HOURS = { offHoursEvents: 0, offHoursCommits: 0, offHoursReviews: 0, weekend: 0, night: 0 };
  const breakdown: WorkloadContributorBreakdown[] = insufficient
    ? []
    : Array.from(totalEventsByContributor.keys())
        .map((cid) => {
          const stats = byContributor.get(cid) ?? NO_OFF_HOURS;
          return {
            label: displayName(cid),
            totalEvents: totalEventsByContributor.get(cid) ?? 0,
            commits: commitsByContributor.get(cid) ?? 0,
            reviews: reviewsByContributor.get(cid) ?? 0,
            offHoursEvents: stats.offHoursEvents,
            offHoursCommits: stats.offHoursCommits,
            offHoursReviews: stats.offHoursReviews,
            weekend: stats.weekend,
            night: stats.night,
          };
        })
        // Off-hours load first (the signal), then overall activity.
        .sort((a, b) => b.offHoursEvents - a.offHoursEvents || b.totalEvents - a.totalEvents);

  const evidenceRefs: WorkloadEvidenceRef[] = insufficient
    ? []
    : [...offHoursEvents]
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .slice(0, WORKLOAD_EVIDENCE_LIMIT)
        .map((e) => ({ entityType: e.entityType, entityId: e.entityId }));

  const severity: WorkloadSeverity = insufficient || offHoursPct === null ? "low" : severityFromPct(offHoursPct);

  return {
    repositoryId,
    aggregate: {
      totalEvents,
      offHoursEvents: offHoursEvents.length,
      offHoursPct,
      weekendCount,
      nightCount,
      commitCount: countedCommitEvents,
      reviewCount: humanReviews.length,
      offHoursCommitCount,
      offHoursReviewCount,
      distinctContributorsOffHours,
      windowStart,
      windowEnd,
      dataStatus: insufficient ? "insufficient_data" : "ok",
    },
    breakdown,
    evidenceRefs,
    severity,
  };
}
