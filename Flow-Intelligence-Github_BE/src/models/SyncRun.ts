import mongoose, { Document, Schema } from "mongoose";

export type SyncRunStatus = "running" | "success" | "partial" | "failed";
export type SyncRunType = "initial_backfill" | "polling" | "webhook_triggered" | "manual";

export interface ISyncRun extends Document {
  repositoryId: mongoose.Types.ObjectId;
  type: SyncRunType;
  status: SyncRunStatus;
  startedAt: Date;
  completedAt: Date | null;
  recordsProcessed: number;
  errorMessage: string | null;
  /** Number of days back that were fetched */
  backfillWindowDays: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const syncRunSchema = new Schema<ISyncRun>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    type: {
      type: String,
      enum: ["initial_backfill", "polling", "webhook_triggered", "manual"],
      required: true,
    },
    status: {
      type: String,
      enum: ["running", "success", "partial", "failed"],
      default: "running",
    },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, default: null },
    recordsProcessed: { type: Number, default: 0 },
    errorMessage: { type: String, default: null },
    backfillWindowDays: { type: Number, default: null },
  },
  { timestamps: true }
);

// Query index per design doc
syncRunSchema.index({ repositoryId: 1, startedAt: -1 });

export const SyncRun = mongoose.model<ISyncRun>("SyncRun", syncRunSchema, "syncRuns");
