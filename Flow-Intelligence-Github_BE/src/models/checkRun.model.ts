import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICheckRun extends Document {
  repositoryId: Types.ObjectId;
  pullRequestId?: Types.ObjectId;
  githubCheckId: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?:
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'timed_out'
    | 'action_required'
    | 'stale'
    | 'skipped';
  headSha?: string;
  startedAt?: Date;
  completedAt?: Date;
  detailsUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CheckRunSchema = new Schema<ICheckRun>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'GitHubRepository', required: true, index: true },
    pullRequestId: { type: Schema.Types.ObjectId, ref: 'PullRequest', index: true },
    githubCheckId: { type: Number, required: true, unique: true, sparse: true },
    name: { type: String, required: true },
    status: { type: String, enum: ['queued', 'in_progress', 'completed'], required: true },
    conclusion: {
      type: String,
      enum: ['success', 'failure', 'neutral', 'cancelled', 'timed_out', 'action_required', 'stale', 'skipped'],
    },
    headSha: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
    detailsUrl: { type: String },
  },
  { timestamps: true }
);

CheckRunSchema.index({ repositoryId: 1, conclusion: 1, completedAt: -1 });
CheckRunSchema.index({ pullRequestId: 1, completedAt: -1 });

export const CheckRun = mongoose.models.CheckRun || mongoose.model<ICheckRun>('CheckRun', CheckRunSchema);
