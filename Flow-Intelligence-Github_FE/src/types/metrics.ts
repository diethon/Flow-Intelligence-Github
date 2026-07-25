// ─── Repository ───────────────────────────────────────────────────────────────

export interface Repository {
  _id: string;
  owner: string;
  name: string;
  fullName: string;
  lastSyncedAt: string | null;
  slackWebhookUrl?: string | null;
  scheduleEnabled?: boolean;
  scheduleDay?: string;
  scheduleTime?: string;
  role?: 'leader' | 'dev' | 'viewer';
  isPrivate?: boolean;
}

// ─── UC-10 Review and CI Metrics ─────────────────────────────────────────────

export interface PerPRPickup {
  prNumber: number;
  title: string;
  pickupHours: number | null;
}

export interface PerPRTurnaround {
  prNumber: number;
  title: string;
  turnaroundHours: number | null;
}

export interface ReviewerBreakdown {
  reviewerId: string;
  login: string;
  count: number;
  pct: number;
}

export interface CheckBreakdown {
  name: string;
  total: number;
  failed: number;
  failRate: number;
}

export type DataStatus = "ok" | "insufficient_data" | "partial";

export interface ReviewPickupResult {
  avgHours: number | null;
  medianHours: number | null;
  sampleSize: number;
  dataStatus: DataStatus;
  perPR: PerPRPickup[];
}

export interface ReviewTurnaroundResult {
  avgHours: number | null;
  medianHours: number | null;
  sampleSize: number;
  dataStatus: DataStatus;
  perPR: PerPRTurnaround[];
}

export interface ReviewLoadConcentrationResult {
  topReviewerPct: number | null;
  concentrationIndex: number | null;
  totalReviews: number;
  reviewerBreakdown: ReviewerBreakdown[];
  dataStatus: DataStatus;
}

export interface FailedCheckRateResult {
  failedRatePct: number | null;
  totalRuns: number;
  failedRuns: number;
  successRuns: number;
  dataStatus: DataStatus;
  checkBreakdown: CheckBreakdown[];
}

export interface UC10MetricsResult {
  repositoryId: string;
  windowStart: string;
  windowEnd: string;
  windowDays: number;
  reviewPickup: ReviewPickupResult;
  reviewTurnaround: ReviewTurnaroundResult;
  reviewLoadConcentration: ReviewLoadConcentrationResult;
  failedCheckRate: FailedCheckRateResult;
  computedAt: string;
}

// ─── Comparison ───────────────────────────────────────────────────────────────

export interface MetricComparison {
  metric: string;
  current: number | null;
  previous: number | null;
  delta: number | null;
  deltaDirection: "up" | "down" | "same" | "no_data";
  unit: string;
}

export interface ComparisonResult {
  current: UC10MetricsResult;
  previous: UC10MetricsResult;
  comparison: MetricComparison[];
}
