import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICommit extends Document {
  repositoryId: Types.ObjectId;
  githubSha: string;
  authorGithubId?: number;
  authorLogin?: string;
  message?: string;
  committedAt: Date;
  pullRequestId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CommitSchema = new Schema<ICommit>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'GitHubRepository', required: true, index: true },
    githubSha: { type: String, required: true },
    authorGithubId: { type: Number },
    authorLogin: { type: String },
    message: { type: String },
    committedAt: { type: Date, required: true },
    pullRequestId: { type: Schema.Types.ObjectId, ref: 'PullRequest', index: true },
  },
  { timestamps: true }
);

CommitSchema.index({ repositoryId: 1, githubSha: 1 }, { unique: true });
CommitSchema.index({ repositoryId: 1, committedAt: -1 });

export const Commit = mongoose.models.Commit || mongoose.model<ICommit>('Commit', CommitSchema);
