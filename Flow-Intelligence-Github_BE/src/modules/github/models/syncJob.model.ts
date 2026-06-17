import mongoose, { Schema, Document, Types } from 'mongoose';

export type SyncJobType = 'commits' | 'pull_requests' | 'issues' | 'branches' | 'sync_pull_requests' | 'sync_reviews' | 'sync_review_requests';

export interface ISyncJob extends Document {
  syncRunId: Types.ObjectId;
  repositoryId: Types.ObjectId;
  jobType: SyncJobType;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  itemsProcessed: number;
  error?: string;
  runAfter?: Date;
  attempts?: number;
  payload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const SyncJobSchema = new Schema<ISyncJob>(
  {
    syncRunId: { type: Schema.Types.ObjectId, ref: 'SyncRun', required: true, index: true },
    repositoryId: { type: Schema.Types.ObjectId, ref: 'GitHubRepository', required: true, index: true },
    jobType: { 
      type: String, 
      enum: ['commits', 'pull_requests', 'issues', 'branches', 'sync_pull_requests', 'sync_reviews', 'sync_review_requests'], 
      required: true 
    },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    itemsProcessed: { type: Number, default: 0 },
    error: { type: String },
    runAfter: { type: Date },
    attempts: { type: Number, default: 0 },
    payload: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const SyncJob =
  mongoose.models.SyncJob ||
  mongoose.model<ISyncJob>('SyncJob', SyncJobSchema);
