import mongoose, { Document, Schema } from "mongoose";

export type SyncJobType =
  | "initial_backfill"
  | "polling"
  | "recompute_metrics"
  | "recompute_risk"
  | "generate_brief";

export type SyncJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface ISyncJob extends Document {
  repositoryId: mongoose.Types.ObjectId;
  type: SyncJobType;
  status: SyncJobStatus;
  /** Do not process before this time (used for delayed/scheduled jobs) */
  runAfter: Date;
  /** Locked by a worker at this time to prevent duplicate processing */
  lockedAt: Date | null;
  /** Worker instance that locked this job */
  lockedBy: string | null;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  payload: Record<string, unknown>;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const syncJobSchema = new Schema<ISyncJob>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    type: {
      type: String,
      enum: ["initial_backfill", "polling", "recompute_metrics", "recompute_risk", "generate_brief"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed", "cancelled"],
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
  },
  { timestamps: true }
);

// Query index per design doc — used to poll for available jobs
syncJobSchema.index({ status: 1, runAfter: 1, lockedAt: 1 });

export const SyncJob = mongoose.model<ISyncJob>("SyncJob", syncJobSchema, "syncJobs");
