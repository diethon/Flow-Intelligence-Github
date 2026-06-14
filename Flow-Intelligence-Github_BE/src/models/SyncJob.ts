import { Schema, model, Document, Types } from 'mongoose';

export type SyncJobType = 'backfill' | 'polling' | 'recompute_metrics' | 'generate_brief';

export interface ISyncJob extends Document {
  repositoryId: Types.ObjectId;
  type: SyncJobType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  runAfter: Date;
  lockedAt?: Date;
  lockedBy?: string;
  completedAt?: Date;
  errorMessage?: string;
  retryCount: number;
}

const SyncJobSchema = new Schema<ISyncJob>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    type: {
      type: String,
      enum: ['backfill', 'polling', 'recompute_metrics', 'generate_brief'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      required: true,
      default: 'pending',
    },
    runAfter: { type: Date, required: true, default: Date.now },
    lockedAt: { type: Date },
    lockedBy: { type: String },
    completedAt: { type: Date },
    errorMessage: { type: String },
    retryCount: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

// Critical index for job queue polling
SyncJobSchema.index({ status: 1, runAfter: 1, lockedAt: 1 });

export const SyncJob = model<ISyncJob>('SyncJob', SyncJobSchema);
