import mongoose from "mongoose";
import { Repository } from "../models/Repository.js";
import { DataQualityWarning } from "../models/DataQualityWarning.js";
import { SyncRun } from "../models/SyncRun.js";
import { FlowRule } from "../models/FlowRule.js";
import { Recommendation } from "../models/Recommendation.js";
import { calculateUC10Metrics, persistUC10Snapshots } from "./metricsEngine.js";
import { calculatePRMetrics, persistPRMetricSnapshots } from "./prMetrics.js";
import { EvidenceCard, RiskEvent, PrDelayPrediction } from "../models/index.js";
import { evaluateRiskRules, RiskEvaluationResult, RiskEventDTO } from "./riskRuleEngine.js";

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
  recentEvidenceCards: any[];
  recentRiskEvents: any[];
  recentPredictions: any[];
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
  const [uc10, prMetrics, riskEvaluation] = await Promise.all([
    calculateUC10Metrics(repositoryId, windowDays, startDate, endDate),
    calculatePRMetrics(repositoryId, windowDays, startDate, endDate),
    evaluateRiskRules(repositoryId, windowDays, startDate, endDate),
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
  const bottlenecks = await buildBottleneckCards(riskEvaluation);

  // ── Overall Risk Level ────────────────────────────────────────────────────
  const overallRiskLevel: RiskLevel = riskEvaluation.overallRisk;
  const triggeredRuleCount = riskEvaluation.triggeredCount;

  // ── Data Quality Summary ──────────────────────────────────────────────────
  const dataQuality = await buildDataQualitySummary(repoId);

  // ── Recent Risk Intelligence ────────────────────────────────────────────────
  const [recentEvidenceCards, rawRecentRiskEvents, recentPredictions] = await Promise.all([
    EvidenceCard.find({ repositoryId: repoId }).sort({ createdAt: -1 }).limit(3).lean(),
    RiskEvent.find({ repositoryId: repoId }).sort({ createdAt: -1 }).limit(3).lean(),
    PrDelayPrediction.find({ repositoryId: repoId }).populate("pullRequestId", "number title prUrl").sort({ createdAt: -1 }).limit(3).lean(),
  ]);

  const recentRiskEvents = await Promise.all(rawRecentRiskEvents.map(async (ev) => {
    const card = await EvidenceCard.findOne({ riskEventId: ev._id }).lean();
    return {
      ...ev,
      evidenceCard: card ? {
        ...card,
        evidence: card.evidence?.map((e: any) => ({
          ...e,
          entityId: e.entityId ? e.entityId.toString() : "",
        }))
      } : null,
    };
  }));

  return {
    repositoryId,
    repositoryName: repo.name,
    repositoryFullName: repo.fullName,
    windowDays,
    windowStart,
    windowEnd,
    overallRiskLevel,
    triggeredRuleCount,
    kpis,
    bottlenecks,
    dataQuality,
    recentEvidenceCards,
    recentRiskEvents,
    recentPredictions,
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
  riskEvaluation: RiskEvaluationResult
): Promise<BottleneckCard[]> {
  const bottlenecks: BottleneckCard[] = [];

  for (const ev of riskEvaluation.events) {
    bottlenecks.push({
      ruleCode: ev.ruleCode,
      ruleName: ev.ruleName,
      severity: ev.severity as "high" | "medium" | "low",
      isTriggered: ev.isTriggered,
      metricValue: ev.metricValue,
      threshold: ev.thresholdValue,
      thresholdUnit: ev.thresholdUnit,
      metricLabel: ev.metricLabel,
      affectedCount: ev.evidenceCard?.evidence?.length || 0,
      affectedItems: ev.evidenceCard?.evidence?.map((e: any) => ({ label: e.label })) || [],
      suggestedAction: ev.evidenceCard?.suggestedAction || "",
      evidenceType: "evidence",
      dataStatus: ev.status === "insufficient_data" ? "insufficient_data" : "ok",
    });
  }

  return bottlenecks;
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
