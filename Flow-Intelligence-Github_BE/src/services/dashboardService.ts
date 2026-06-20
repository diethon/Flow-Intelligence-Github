import mongoose from "mongoose";
import { Repository } from "../models/Repository.js";
import { DataQualityWarning } from "../models/DataQualityWarning.js";
import { SyncRun } from "../models/SyncRun.js";
import { FlowRule } from "../models/FlowRule.js";
import { Recommendation } from "../models/Recommendation.js";
import { calculateUC10Metrics, persistUC10Snapshots } from "./metricsEngine.js";
import { calculatePRMetrics, persistPRMetricSnapshots } from "./prMetrics.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = "high" | "medium" | "low" | "good";

export interface KPICard {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  trend: "good" | "warn" | "bad" | "neutral";
  dataStatus: "ok" | "insufficient_data" | "partial";
  description: string;
}

export interface BottleneckCard {
  ruleCode: string;
  ruleName: string;
  severity: "high" | "medium" | "low";
  isTriggered: boolean;
  metricValue: number | null;
  threshold: number;
  thresholdUnit: string;
  metricLabel: string;
  affectedCount: number;
  affectedItems: { label: string }[];
  suggestedAction: string;
  evidenceType: string;
  dataStatus: "ok" | "insufficient_data" | "partial";
}

export interface DataQualitySummary {
  level: "good" | "partial" | "poor";
  warnings: { code: string; severity: string; message: string }[];
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
}

export interface DashboardSummary {
  repositoryId: string;
  repositoryName: string;
  repositoryFullName: string;
  windowDays: number;
  windowStart: Date;
  windowEnd: Date;
  overallRiskLevel: RiskLevel;
  triggeredRuleCount: number;
  kpis: KPICard[];
  bottlenecks: BottleneckCard[];
  dataQuality: DataQualitySummary;
  computedAt: Date;
}

// ─── Thresholds mirroring R1–R5 rulebook ────────────────────────────────────

const RULE_CONFIG = {
  R1: { metric: "stale_pr_count", threshold: 3, unit: "count", label: "Stale PRs", operator: "gte" as const },
  R2: { metric: "review_pickup_time_avg_hours", threshold: 12, unit: "hours", label: "Avg Review Pickup Time", operator: "gte" as const },
  R3: { metric: "review_load_top_reviewer_pct", threshold: 50, unit: "%", label: "Top Reviewer Load", operator: "gte" as const },
  R4: { metric: "failed_check_rate_pct", threshold: 25, unit: "%", label: "Failed Check Rate", operator: "gte" as const },
  R5: { metric: "oversized_pr_count", threshold: 2, unit: "count", label: "Oversized PRs (>500 lines)", operator: "gte" as const },
};

// ─── Main Service ─────────────────────────────────────────────────────────────

export async function buildDashboard(
  repositoryId: string,
  windowDays: number = 7,
  startDate?: Date,
  endDate?: Date
): Promise<DashboardSummary> {
  const repoId = new mongoose.Types.ObjectId(repositoryId);

  // Load repo info
  const repo = await Repository.findById(repoId).lean();
  if (!repo) throw new Error(`Repository ${repositoryId} not found`);

  // Calculate fresh metrics in parallel
  const [uc10, prMetrics] = await Promise.all([
    calculateUC10Metrics(repositoryId, windowDays, startDate, endDate),
    calculatePRMetrics(repositoryId, windowDays, startDate, endDate),
  ]);

  // Persist snapshots in background (fire-and-forget)
  void Promise.all([
    persistUC10Snapshots(uc10),
    persistPRMetricSnapshots(prMetrics),
  ]);

  const windowStart = uc10.windowStart;
  const windowEnd = uc10.windowEnd;

  // Build a flat metric map for rule evaluation
  const metricMap: Record<string, { value: number | null; dataStatus: string }> = {
    stale_pr_count: { value: prMetrics.stalePRCount, dataStatus: prMetrics.dataStatus },
    open_pr_count: { value: prMetrics.openPRCount, dataStatus: prMetrics.dataStatus },
    oversized_pr_count: { value: prMetrics.oversizedPRCount, dataStatus: prMetrics.dataStatus },
    pr_cycle_time_avg_hours: { value: prMetrics.cycleTimeAvgHours, dataStatus: prMetrics.dataStatus },
    pr_merge_time_avg_hours: { value: prMetrics.mergeTimeAvgHours, dataStatus: prMetrics.dataStatus },
    review_pickup_time_avg_hours: { value: uc10.reviewPickup.avgHours, dataStatus: uc10.reviewPickup.dataStatus },
    review_pickup_time_median_hours: { value: uc10.reviewPickup.medianHours, dataStatus: uc10.reviewPickup.dataStatus },
    review_turnaround_time_avg_hours: { value: uc10.reviewTurnaround.avgHours, dataStatus: uc10.reviewTurnaround.dataStatus },
    review_load_top_reviewer_pct: { value: uc10.reviewLoadConcentration.topReviewerPct, dataStatus: uc10.reviewLoadConcentration.dataStatus },
    failed_check_rate_pct: { value: uc10.failedCheckRate.failedRatePct, dataStatus: uc10.failedCheckRate.dataStatus },
    total_reviews: { value: uc10.reviewLoadConcentration.totalReviews, dataStatus: uc10.reviewLoadConcentration.dataStatus },
  };

  // ── Build KPI Cards ──────────────────────────────────────────────────────
  const kpis: KPICard[] = buildKPICards(metricMap, prMetrics, uc10);

  // ── Evaluate Rules & Build Bottleneck Cards ──────────────────────────────
  const bottlenecks = await buildBottleneckCards(metricMap, prMetrics, uc10, repositoryId);

  // ── Overall Risk Level ────────────────────────────────────────────────────
  const triggeredRules = bottlenecks.filter((b) => b.isTriggered);
  const hasHigh = triggeredRules.some((b) => b.severity === "high");
  const hasMedium = triggeredRules.some((b) => b.severity === "medium");
  const overallRiskLevel: RiskLevel =
    triggeredRules.length === 0 ? "good" : hasHigh ? "high" : hasMedium ? "medium" : "low";

  // ── Data Quality Summary ──────────────────────────────────────────────────
  const dataQuality = await buildDataQualitySummary(repoId);

  return {
    repositoryId,
    repositoryName: repo.name,
    repositoryFullName: repo.fullName,
    windowDays,
    windowStart,
    windowEnd,
    overallRiskLevel,
    triggeredRuleCount: triggeredRules.length,
    kpis,
    bottlenecks,
    dataQuality,
    computedAt: new Date(),
  };
}

// ─── KPI Cards Builder ────────────────────────────────────────────────────────

function getTrend(
  value: number | null,
  thresholds: { good: number; warn: number },
  lowerIsBetter = true
): "good" | "warn" | "bad" | "neutral" {
  if (value === null) return "neutral";
  if (lowerIsBetter) {
    if (value <= thresholds.good) return "good";
    if (value <= thresholds.warn) return "warn";
    return "bad";
  } else {
    if (value >= thresholds.good) return "good";
    if (value >= thresholds.warn) return "warn";
    return "bad";
  }
}

type MetricMap = Record<string, { value: number | null; dataStatus: string }>;
type UC10Result = Awaited<ReturnType<typeof calculateUC10Metrics>>;
type PRMetricsResult = Awaited<ReturnType<typeof calculatePRMetrics>>;

function buildKPICards(
  metricMap: MetricMap,
  prMetrics: PRMetricsResult,
  uc10: UC10Result
): KPICard[] {
  return [
    {
      key: "open_pr_count",
      label: "Open Pull Requests",
      value: prMetrics.openPRCount,
      unit: "PRs",
      trend: getTrend(prMetrics.openPRCount, { good: 5, warn: 10 }),
      dataStatus: prMetrics.dataStatus,
      description: "Total open (non-draft) pull requests in the analysis window.",
    },
    {
      key: "stale_pr_count",
      label: "Stale PRs (>5 days)",
      value: prMetrics.stalePRCount,
      unit: "PRs",
      trend: getTrend(prMetrics.stalePRCount, { good: 0, warn: 2 }),
      dataStatus: prMetrics.dataStatus,
      description: "Pull requests open for more than 5 days without merging. High count triggers R1.",
    },
    {
      key: "review_pickup_time_avg_hours",
      label: "Review Pickup Time",
      value: uc10.reviewPickup.avgHours !== null ? Math.round(uc10.reviewPickup.avgHours * 10) / 10 : null,
      unit: "hrs avg",
      trend: getTrend(uc10.reviewPickup.avgHours, { good: 4, warn: 12 }),
      dataStatus: uc10.reviewPickup.dataStatus,
      description: "Average time from PR opened to first review submission. Over 12 hrs triggers R2.",
    },
    {
      key: "review_load_top_reviewer_pct",
      label: "Reviewer Concentration",
      value: uc10.reviewLoadConcentration.topReviewerPct,
      unit: "% top reviewer",
      trend: getTrend(uc10.reviewLoadConcentration.topReviewerPct, { good: 30, warn: 50 }),
      dataStatus: uc10.reviewLoadConcentration.dataStatus,
      description: "Share of reviews by the most active reviewer. Over 50% triggers R3.",
    },
    {
      key: "failed_check_rate_pct",
      label: "Failed Check Rate",
      value: uc10.failedCheckRate.failedRatePct,
      unit: "%",
      trend: getTrend(uc10.failedCheckRate.failedRatePct, { good: 10, warn: 25 }),
      dataStatus: uc10.failedCheckRate.dataStatus,
      description: "Percentage of CI check runs that failed. Over 25% triggers R4.",
    },
    {
      key: "pr_cycle_time_avg_hours",
      label: "PR Cycle Time",
      value: prMetrics.cycleTimeAvgHours !== null ? Math.round(prMetrics.cycleTimeAvgHours * 10) / 10 : null,
      unit: "hrs avg",
      trend: getTrend(prMetrics.cycleTimeAvgHours, { good: 24, warn: 72 }),
      dataStatus: prMetrics.dataStatus,
      description: "Average time from PR opened to merged. Useful for delivery flow health.",
    },
  ];
}

// ─── Bottleneck Cards Builder ─────────────────────────────────────────────────

async function buildBottleneckCards(
  metricMap: MetricMap,
  prMetrics: PRMetricsResult,
  uc10: UC10Result,
  _repositoryId: string
): Promise<BottleneckCard[]> {
  const recommendations = await Recommendation.find().lean();
  const recMap: Record<string, string> = {};
  for (const rec of recommendations) {
    if (!recMap[rec.ruleCode]) recMap[rec.ruleCode] = rec.title;
  }

  const rulesDb = await FlowRule.find({ isActive: true }).lean();
  const ruleMap: Record<string, typeof rulesDb[0]> = {};
  for (const r of rulesDb) ruleMap[r.ruleCode] = r;

  const bottlenecks: BottleneckCard[] = [];

  // R1 – Stale PR
  const r1Value = prMetrics.stalePRCount;
  bottlenecks.push({
    ruleCode: "R1",
    ruleName: ruleMap["R1"]?.name ?? "Stale PR Risk",
    severity: "high",
    isTriggered: r1Value >= RULE_CONFIG.R1.threshold,
    metricValue: r1Value,
    threshold: RULE_CONFIG.R1.threshold,
    thresholdUnit: RULE_CONFIG.R1.unit,
    metricLabel: RULE_CONFIG.R1.label,
    affectedCount: prMetrics.stalePRIds.length,
    affectedItems: prMetrics.stalePRIds.map((p) => ({ label: `#${p.prNumber} — ${p.title} (${p.daysOpen}d open)` })),
    suggestedAction: recMap["R1"] ?? "Review and action stale pull requests",
    evidenceType: "stale_pr",
    dataStatus: prMetrics.dataStatus,
  });

  // R2 – Review Pickup
  const r2Value = uc10.reviewPickup.avgHours;
  bottlenecks.push({
    ruleCode: "R2",
    ruleName: ruleMap["R2"]?.name ?? "Review Pickup Risk",
    severity: "medium",
    isTriggered: r2Value !== null && r2Value >= RULE_CONFIG.R2.threshold,
    metricValue: r2Value !== null ? Math.round(r2Value * 10) / 10 : null,
    threshold: RULE_CONFIG.R2.threshold,
    thresholdUnit: RULE_CONFIG.R2.unit,
    metricLabel: RULE_CONFIG.R2.label,
    affectedCount: uc10.reviewPickup.perPR.filter((p) => p.pickupHours !== null && p.pickupHours > 12).length,
    affectedItems: uc10.reviewPickup.perPR
      .filter((p) => p.pickupHours !== null && p.pickupHours > 12)
      .slice(0, 5)
      .map((p) => ({ label: `#${p.prNumber} — ${p.title} (${p.pickupHours?.toFixed(1)}h pickup)` })),
    suggestedAction: recMap["R2"] ?? "Define a team review SLA",
    evidenceType: "review_pickup",
    dataStatus: uc10.reviewPickup.dataStatus,
  });

  // R3 – Reviewer Concentration
  const r3Value = uc10.reviewLoadConcentration.topReviewerPct;
  const topReviewer = uc10.reviewLoadConcentration.reviewerBreakdown[0];
  bottlenecks.push({
    ruleCode: "R3",
    ruleName: ruleMap["R3"]?.name ?? "Reviewer Concentration Risk",
    severity: "medium",
    isTriggered: r3Value !== null && r3Value >= RULE_CONFIG.R3.threshold,
    metricValue: r3Value,
    threshold: RULE_CONFIG.R3.threshold,
    thresholdUnit: RULE_CONFIG.R3.unit,
    metricLabel: RULE_CONFIG.R3.label,
    affectedCount: uc10.reviewLoadConcentration.reviewerBreakdown.length,
    affectedItems: topReviewer ? [{ label: `${topReviewer.login}: ${topReviewer.count} reviews (${topReviewer.pct}%)` }] : [],
    suggestedAction: recMap["R3"] ?? "Distribute review ownership across the team",
    evidenceType: "reviewer_concentration",
    dataStatus: uc10.reviewLoadConcentration.dataStatus,
  });

  // R4 – CI Friction
  const r4Value = uc10.failedCheckRate.failedRatePct;
  const topFailedCheck = uc10.failedCheckRate.checkBreakdown[0];
  bottlenecks.push({
    ruleCode: "R4",
    ruleName: ruleMap["R4"]?.name ?? "CI Friction Risk",
    severity: "high",
    isTriggered: r4Value !== null && r4Value >= RULE_CONFIG.R4.threshold,
    metricValue: r4Value,
    threshold: RULE_CONFIG.R4.threshold,
    thresholdUnit: RULE_CONFIG.R4.unit,
    metricLabel: RULE_CONFIG.R4.label,
    affectedCount: uc10.failedCheckRate.failedRuns,
    affectedItems: topFailedCheck ? [{ label: `${topFailedCheck.name}: ${topFailedCheck.failRate.toFixed(1)}% fail rate (${topFailedCheck.failed}/${topFailedCheck.total})` }] : [],
    suggestedAction: recMap["R4"] ?? "Investigate the most frequently failing check suites",
    evidenceType: "ci_friction",
    dataStatus: uc10.failedCheckRate.dataStatus,
  });

  // R5 – Oversized PR
  const r5Value = prMetrics.oversizedPRCount;
  bottlenecks.push({
    ruleCode: "R5",
    ruleName: ruleMap["R5"]?.name ?? "Oversized PR Risk",
    severity: "medium",
    isTriggered: r5Value >= RULE_CONFIG.R5.threshold,
    metricValue: r5Value,
    threshold: RULE_CONFIG.R5.threshold,
    thresholdUnit: RULE_CONFIG.R5.unit,
    metricLabel: RULE_CONFIG.R5.label,
    affectedCount: prMetrics.oversizedPRIds.length,
    affectedItems: prMetrics.oversizedPRIds
      .slice(0, 5)
      .map((p) => ({ label: `#${p.prNumber} — ${p.title} (${p.totalLines} lines)` })),
    suggestedAction: recMap["R5"] ?? "Break large changes into smaller pull requests",
    evidenceType: "oversized_pr",
    dataStatus: prMetrics.dataStatus,
  });

  // Sort: triggered first, then by severity (high > medium > low)
  const severityOrder = { high: 0, medium: 1, low: 2 };
  return bottlenecks.sort((a, b) => {
    if (a.isTriggered !== b.isTriggered) return a.isTriggered ? -1 : 1;
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

// ─── Data Quality Summary ─────────────────────────────────────────────────────

async function buildDataQualitySummary(
  repositoryId: mongoose.Types.ObjectId
): Promise<DataQualitySummary> {
  const [warnings, lastSync] = await Promise.all([
    DataQualityWarning.find({ repositoryId, resolvedAt: null })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    SyncRun.findOne({ repositoryId }).sort({ startedAt: -1 }).lean(),
  ]);

  const hasErrors = warnings.some((w) => w.severity === "error");
  const hasWarnings = warnings.some((w) => w.severity === "warning");
  const level = hasErrors ? "poor" : hasWarnings ? "partial" : "good";

  return {
    level,
    warnings: warnings.map((w) => ({ code: w.code, severity: w.severity, message: w.message })),
    lastSyncedAt: lastSync?.completedAt?.toISOString() ?? null,
    lastSyncStatus: lastSync?.status ?? null,
  };
}

// ─── Rulebook with Recommendations ───────────────────────────────────────────

export interface RulebookEntry {
  ruleCode: string;
  name: string;
  description: string;
  metricKey: string;
  threshold: number;
  thresholdUnit: string;
  operator: string;
  severity: string;
  evidenceType: string;
  isActive: boolean;
  recommendations: {
    actionCode: string;
    title: string;
    description: string;
    category: string;
  }[];
}

export async function getRulebook(): Promise<RulebookEntry[]> {
  // Fetch ALL rules (active + inactive) so the frontend can correctly
  // compute "Active" vs "Inactive" counts in the StatsBar.
  const [rules, recommendations] = await Promise.all([
    FlowRule.find().sort({ ruleCode: 1 }).lean(),
    Recommendation.find().lean(),
  ]);

  return rules.map((rule) => ({
    ruleCode: rule.ruleCode,
    name: rule.name,
    description: rule.description,
    metricKey: rule.metricKey,
    threshold: rule.threshold,
    thresholdUnit: rule.thresholdUnit,
    operator: rule.operator,
    severity: rule.severity,
    evidenceType: rule.evidenceType,
    isActive: rule.isActive,
    recommendations: recommendations
      .filter((r) => r.ruleCode === rule.ruleCode)
      .map((r) => ({
        actionCode: r.actionCode,
        title: r.title,
        description: r.description,
        category: r.category,
      })),
  }));
}
