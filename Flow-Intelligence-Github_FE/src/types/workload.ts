import type { EvidenceCard } from "./index";

export type WorkloadSeverity = "high" | "medium" | "low";
export type WorkloadDataStatus = "ok" | "insufficient_data";

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
  windowStart: string;
  windowEnd: string;
  dataStatus: WorkloadDataStatus;
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

export interface WorkloadAiItem {
  type: "risk_summary" | "recommendation";
  title: string;
  detail: string;
  severity: "high" | "medium" | "low" | "info";
}

/** Per-member commentary. `contributor` is the real GitHub login (page shows identities). */
export interface WorkloadContributorInsight {
  contributor: string;
  note: string;
  suggestion?: string;
  totalEvents: number;
  offHoursEvents: number;
  commits: number;
  reviews: number;
  night: number;
  weekend: number;
}

export interface WorkloadAiAnalysis {
  summary: string;
  confidence: "high" | "medium" | "low";
  limitations: string[];
  items: WorkloadAiItem[];
  contributorInsights: WorkloadContributorInsight[];
  isFallback: boolean;
}

export interface WorkloadRiskResult {
  severity: WorkloadSeverity;
  aggregate: WorkloadRiskAggregate;
  breakdown: WorkloadContributorBreakdown[];
  card: EvidenceCard | null;
  aiAnalysis: WorkloadAiAnalysis | null;
}
