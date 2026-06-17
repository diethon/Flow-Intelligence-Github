import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISyncRun extends Document {
  repositoryId: Types.ObjectId;
  status: 'pending' | 'running' | 'completed' | 'failed';
  triggeredBy: 'webhook' | 'manual' | 'scheduled';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  stats?: {
    commits: number;
    pullRequests: number;
    issues: number;
  };
  createdAt: Date;
}

const SyncRunSchema = new Schema<ISyncRun>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'GitHubRepository', required: true, index: true },
    status: { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },
    triggeredBy: { type: String, enum: ['webhook', 'manual', 'scheduled'], default: 'manual' },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    error: { type: String },
    stats: {
      commits: { type: Number, default: 0 },
      pullRequests: { type: Number, default: 0 },
      issues: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export const SyncRun =
  mongoose.models.SyncRun ||
  mongoose.model<ISyncRun>('SyncRun', SyncRunSchema);
