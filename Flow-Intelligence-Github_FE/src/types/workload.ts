import type { EvidenceCard } from "./index";

export type WorkloadSeverity = "high" | "medium" | "low";
export type WorkloadDataStatus = "ok" | "insufficient_data";

export interface WorkloadRiskAggregate {
  totalEvents: number;
  offHoursEvents: number;
  offHoursPct: number | null;
  weekendCount: number;
  nightCount: number;
  distinctContributorsOffHours: number;
  windowStart: string;
  windowEnd: string;
  dataStatus: WorkloadDataStatus;
}

/** Per-contributor breakdown. `label` carries the real GitHub identity. */
export interface WorkloadContributorBreakdown {
  label: string;
  totalCommits: number;
  offHoursEvents: number;
  weekend: number;
  night: number;
}

export interface WorkloadAiItem {
  type: "risk_summary" | "recommendation";
  title: string;
  detail: string;
  severity: "high" | "medium" | "low" | "info";
}

export interface WorkloadAiAnalysis {
  summary: string;
  confidence: "high" | "medium" | "low";
  limitations: string[];
  items: WorkloadAiItem[];
  isFallback: boolean;
}

export interface WorkloadRiskResult {
  severity: WorkloadSeverity;
  aggregate: WorkloadRiskAggregate;
  breakdown: WorkloadContributorBreakdown[];
  card: EvidenceCard | null;
  aiAnalysis: WorkloadAiAnalysis | null;
}
