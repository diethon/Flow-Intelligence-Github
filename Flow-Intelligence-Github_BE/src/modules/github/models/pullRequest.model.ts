import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPullRequest extends Document {
  repositoryId: Types.ObjectId;
  githubPrId: number;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  body?: string;
  authorGithubId: number;
  authorLogin: string;
  headRef: string;
  baseRef: string;
  headRepoFullName?: string;
  baseRepoFullName: string;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  commits?: number;
  prCreatedAt: Date;
  prUpdatedAt: Date;
  prClosedAt?: Date;
  prMergedAt?: Date;
  prUrl: string;
  draft: boolean;
  mergeable?: boolean;
  merged: boolean;
  labels: string[];
  assignees: string[];
  requestedReviewers: string[];
  createdAt: Date;
  updatedAt: Date;
}

const PullRequestSchema = new Schema<IPullRequest>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'GitHubRepository', required: true, index: true },
    githubPrId: { type: Number, required: true, unique: true },
    number: { type: Number, required: true },
    title: { type: String, required: true },
    state: { type: String, enum: ['open', 'closed', 'merged'], required: true },
    body: { type: String },
    authorGithubId: { type: Number, required: true },
    authorLogin: { type: String, required: true },
    headRef: { type: String, required: true },
    baseRef: { type: String, required: true },
    headRepoFullName: { type: String },
    baseRepoFullName: { type: String, required: true },
    additions: { type: Number },
    deletions: { type: Number },
    changedFiles: { type: Number },
    commits: { type: Number },
    prCreatedAt: { type: Date, required: true },
    prUpdatedAt: { type: Date, required: true },
    prClosedAt: { type: Date },
    prMergedAt: { type: Date },
    prUrl: { type: String, required: true },
    draft: { type: Boolean, default: false },
    mergeable: { type: Boolean },
    merged: { type: Boolean, default: false },
    labels: [{ type: String }],
    assignees: [{ type: String }],
    requestedReviewers: [{ type: String }],
  },
  { timestamps: true }
);

PullRequestSchema.index({ repositoryId: 1, number: 1 }, { unique: true });
PullRequestSchema.index({ repositoryId: 1, state: 1 });
PullRequestSchema.index({ authorLogin: 1 });

export const PullRequest =
  mongoose.models.PullRequest || mongoose.model<IPullRequest>('PullRequest', PullRequestSchema);
