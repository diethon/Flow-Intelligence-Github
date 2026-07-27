import mongoose, { Document, Schema } from "mongoose";

export type SyncRunStatus = "running" | "success" | "partial" | "failed";
export type SyncRunType = "initial" | "incremental" | "webhook" | "initial_backfill" | "polling" | "webhook_triggered" | "manual";

export interface ISyncRun extends Document {
  repositoryId: mongoose.Types.ObjectId;
  type: SyncRunType;
  status: SyncRunStatus;
  startedAt: Date;
  completedAt: Date | null;
  finishedAt?: Date | null;
  recordsProcessed: number;
  errorMessage: string | null;
  warnings?: string[];
  backfillWindowDays: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const syncRunSchema = new Schema<ISyncRun>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    type: {
      type: String,
      enum: ["initial", "incremental", "webhook", "initial_backfill", "polling", "webhook_triggered", "manual"],
      required: true,
    },
    status: {
      type: String,
      enum: ["running", "success", "partial", "failed"],
      default: "running",
    },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    recordsProcessed: { type: Number, default: 0 },
    errorMessage: { type: String, default: null },
    warnings: [{ type: String }],
    backfillWindowDays: { type: Number, default: null },
  },
  { timestamps: true }
);

// Query index per design doc
syncRunSchema.index({ repositoryId: 1, startedAt: -1 });

// Tự động xóa lịch sử sync run sau 30 ngày (cái ni t phồng hờ thôi vì data sync nhiều quá)
// syncRunSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const SyncRun = mongoose.models.SyncRun || mongoose.model<ISyncRun>("SyncRun", syncRunSchema, "syncRuns");
