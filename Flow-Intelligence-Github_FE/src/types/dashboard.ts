import type { Repository } from "./metrics.js";
export type { Repository };

// ─── Risk ─────────────────────────────────────────────────────────────────────
export type RiskLevel = "high" | "medium" | "low" | "good";
export type DataStatus = "ok" | "insufficient_data" | "partial";
export type DataQualityLevel = "good" | "partial" | "poor";

// ─── KPI Card ─────────────────────────────────────────────────────────────────
export interface KPICard {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  trend: "good" | "warn" | "bad" | "neutral";
  dataStatus: DataStatus;
  description: string;
}

// ─── Bottleneck Card ──────────────────────────────────────────────────────────
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
  dataStatus: DataStatus;
}

// ─── Data Quality Summary ─────────────────────────────────────────────────────
export interface DataQualityWarning {
  code: string;
  severity: string;
  message: string;
}

export interface DataQualitySummary {
  level: DataQualityLevel;
  warnings: DataQualityWarning[];
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
}

// ─── Dashboard Summary ────────────────────────────────────────────────────────
export interface DashboardSummary {
  repositoryId: string;
  repositoryName: string;
  repositoryFullName: string;
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  overallRiskLevel: RiskLevel;
  triggeredRuleCount: number;
  kpis: KPICard[];
  bottlenecks: BottleneckCard[];
  dataQuality: DataQualitySummary;
  computedAt: string;
}

// ─── Rulebook ─────────────────────────────────────────────────────────────────
export interface RulebookRecommendation {
  actionCode: string;
  title: string;
  description: string;
  category: "process" | "tooling" | "communication" | "visibility";
}

export interface RulebookEntry {
  ruleCode: string;
  name: string;
  description: string;
  metricKey: string;
  threshold: number;
  thresholdUnit: string;
  operator: "gte" | "lte";
  severity: "high" | "medium" | "low";
  evidenceType: string;
  isActive: boolean;
  recommendations: RulebookRecommendation[];
}
