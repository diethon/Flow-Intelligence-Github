import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IIssue extends Document {
  repositoryId: Types.ObjectId;
  githubIssueId: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  authorGithubId: number;
  authorLogin: string;
  labels: string[];
  assignees: string[];
  issueCreatedAt: Date;
  issueUpdatedAt: Date;
  issueClosedAt?: Date;
  issueUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

const IssueSchema = new Schema<IIssue>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'GitHubRepository', required: true, index: true },
    githubIssueId: { type: Number, required: true, unique: true },
    number: { type: Number, required: true },
    title: { type: String, required: true },
    state: { type: String, enum: ['open', 'closed'], required: true },
    authorGithubId: { type: Number, required: true },
    authorLogin: { type: String, required: true },
    labels: [{ type: String }],
    assignees: [{ type: String }],
    issueCreatedAt: { type: Date, required: true },
    issueUpdatedAt: { type: Date, required: true },
    issueClosedAt: { type: Date },
    issueUrl: { type: String, required: true },
  },
  { timestamps: true }
);

IssueSchema.index({ repositoryId: 1, number: 1 }, { unique: true });
IssueSchema.index({ repositoryId: 1, state: 1, issueCreatedAt: -1 });

export const Issue = mongoose.models.Issue || mongoose.model<IIssue>('Issue', IssueSchema);
