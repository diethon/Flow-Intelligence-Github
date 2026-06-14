import { Schema, model, Document, Types } from 'mongoose';

export interface IPullRequest extends Document {
  repositoryId: Types.ObjectId;
  githubPrId: number;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  isDraft: boolean;
  authorId: Types.ObjectId;
  createdAt: Date;
  readyForReviewAt?: Date;
  mergedAt?: Date;
  closedAt?: Date;
  additions: number;
  deletions: number;
  changedFiles: number;
}

const PullRequestSchema = new Schema<IPullRequest>(
  {
    repositoryId: { type: Schema.Types.ObjectId, required: true },
    githubPrId: { type: Number, required: true },
    number: { type: Number, required: true },
    title: { type: String, required: true },
    state: { type: String, enum: ['open', 'closed', 'merged'], required: true },
    isDraft: { type: Boolean, required: true, default: false },
    authorId: { type: Schema.Types.ObjectId, required: true },
    readyForReviewAt: { type: Date },
    mergedAt: { type: Date },
    closedAt: { type: Date },
    additions: { type: Number, required: true, default: 0 },
    deletions: { type: Number, required: true, default: 0 },
    changedFiles: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

PullRequestSchema.index({ repositoryId: 1, number: 1 }, { unique: true });
PullRequestSchema.index({ repositoryId: 1, createdAt: -1 });
PullRequestSchema.index({ repositoryId: 1, state: 1 });
PullRequestSchema.index({ repositoryId: 1, mergedAt: -1 });

export const PullRequest = model<IPullRequest>('PullRequest', PullRequestSchema);
