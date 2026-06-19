import mongoose, { Document, Schema } from "mongoose";

export type MetricKey =
  | "review_pickup_time_avg_hours"
  | "review_pickup_time_median_hours"
  | "review_turnaround_time_avg_hours"
  | "review_turnaround_time_median_hours"
  | "review_load_concentration_pct"
  | "review_load_top_reviewer_pct"
  | "failed_check_rate_pct"
  | "total_check_runs"
  | "failed_check_runs"
  | "total_reviews"
  | "prs_with_review_count"
  | "pr_cycle_time_avg_hours"
  | "pr_cycle_time_median_hours"
  | "pr_merge_time_avg_hours"
  | "open_pr_count"
  | "stale_pr_count"
  | "oversized_pr_count";

export interface IMetricSnapshot extends Document {
  repositoryId: mongoose.Types.ObjectId;
  metricKey: MetricKey;
  value: number | null;
  unit: string;
  windowStart: Date;
  windowEnd: Date;
  dataStatus: "ok" | "insufficient_data" | "partial";
  sampleSize: number;
  computedAt: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const metricSnapshotSchema = new Schema<IMetricSnapshot>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    metricKey: { type: String, required: true },
    value: { type: Number, default: null },
    unit: { type: String, required: true },
    windowStart: { type: Date, required: true },
    windowEnd: { type: Date, required: true },
    dataStatus: { type: String, enum: ["ok", "insufficient_data", "partial"], default: "ok" },
    sampleSize: { type: Number, default: 0 },
    computedAt: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Unique index per design doc
metricSnapshotSchema.index(
  { repositoryId: 1, windowStart: 1, windowEnd: 1, metricKey: 1 },
  { unique: true }
);
// Query index per design doc
metricSnapshotSchema.index({ repositoryId: 1, metricKey: 1, computedAt: -1 });

export const MetricSnapshot = mongoose.model<IMetricSnapshot>(
  "MetricSnapshot",
  metricSnapshotSchema,
  "metricSnapshots"
);
