import { Schema, model, Document, Types } from 'mongoose';

export interface ISyncRun extends Document {
  repositoryId: Types.ObjectId;
  type: 'backfill' | 'polling' | 'partial';
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  syncedCounts: {
    pullRequests?: number;
    reviews?: number;
    issues?: number;
    commits?: number;
    checkRuns?: number;
  };
  errorMessage?: string;
}

const SyncRunSchema = new Schema<ISyncRun>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    type: { type: String, enum: ['backfill', 'polling', 'partial'], required: true },
    status: { type: String, enum: ['running', 'completed', 'failed'], required: true, default: 'running' },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date },
    syncedCounts: {
      pullRequests: { type: Number, default: 0 },
      reviews: { type: Number, default: 0 },
      issues: { type: Number, default: 0 },
      commits: { type: Number, default: 0 },
      checkRuns: { type: Number, default: 0 },
    },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

SyncRunSchema.index({ repositoryId: 1, startedAt: -1 });

export const SyncRun = model<ISyncRun>('SyncRun', SyncRunSchema);
