import mongoose, { Document, Schema } from "mongoose";

export type DataQualityCode =
  | "missing_checks_permission"
  | "partial_backfill"
  | "failed_backfill"
  | "duplicate_webhook_ignored"
  | "no_review_data"
  | "invalid_timestamps"
  | "missing_review_requests"
  | "rate_limit_reached"
  | "no_pr_data";

export type DataQualitySeverity = "error" | "warning" | "info";

export interface IDataQualityWarning extends Document {
  repositoryId: mongoose.Types.ObjectId;
  code: DataQualityCode;
  severity: DataQualitySeverity;
  message: string;
  /** Which metric/feature is affected */
  affectedMetric: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const dataQualityWarningSchema = new Schema<IDataQualityWarning>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    code: {
      type: String,
      enum: [
        "missing_checks_permission",
        "partial_backfill",
        "failed_backfill",
        "duplicate_webhook_ignored",
        "no_review_data",
        "invalid_timestamps",
        "missing_review_requests",
        "rate_limit_reached",
        "no_pr_data",
      ],
      required: true,
    },
    severity: { type: String, enum: ["error", "warning", "info"], default: "warning" },
    message: { type: String, required: true },
    affectedMetric: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Query index per design doc
dataQualityWarningSchema.index({ repositoryId: 1, severity: 1, createdAt: -1 });

export const DataQualityWarning = mongoose.model<IDataQualityWarning>(
  "DataQualityWarning",
  dataQualityWarningSchema,
  "dataQualityWarnings"
);
