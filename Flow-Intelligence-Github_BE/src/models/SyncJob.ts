import mongoose, { Document, Schema } from "mongoose";

export type SyncJobType =
  | "initial_backfill"
  | "polling"
  | "recompute_metrics"
  | "recompute_risk"
  | "generate_brief"
  | "sync_pull_requests"
  | "sync_reviews"
  | "sync_review_requests"
  | "sync_commits"
  | "sync_issues";

export type SyncJobStatus = "pending" | "running" | "processing" | "completed" | "failed" | "cancelled";

export interface ISyncJob extends Document {
  repositoryId: mongoose.Types.ObjectId;
  syncRunId?: mongoose.Types.ObjectId | null;
  type?: SyncJobType;
  jobType?: string;
  status: SyncJobStatus;
  runAfter: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  payload: Record<string, unknown>;
  completedAt: Date | null;
  itemsProcessed?: number;
  error?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const syncJobSchema = new Schema<ISyncJob>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    syncRunId: { type: Schema.Types.ObjectId, ref: "SyncRun", default: null },
    type: {
      type: String,
      enum: ["initial_backfill", "polling", "recompute_metrics", "recompute_risk", "generate_brief", "sync_pull_requests", "sync_reviews", "sync_review_requests", "sync_commits", "sync_issues"],
    },
    jobType: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "running", "processing", "completed", "failed", "cancelled"],
      default: "pending",
    },
    runAfter: { type: Date, default: Date.now },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    lastError: { type: String, default: null },
    payload: { type: Schema.Types.Mixed, default: {} },
    completedAt: { type: Date, default: null },
    itemsProcessed: { type: Number, default: 0 },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

// Query index per design doc — used to poll for available jobs
syncJobSchema.index({ status: 1, runAfter: 1, lockedAt: 1 });

// Tự động xóa jobs đã tạo sau 7 ngày để tránh phình to database (cái ni t phồng hờ thôi vì data sync nhiều quá)
// syncJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const SyncJob = mongoose.models.SyncJob || mongoose.model<ISyncJob>("SyncJob", syncJobSchema, "syncJobs");
