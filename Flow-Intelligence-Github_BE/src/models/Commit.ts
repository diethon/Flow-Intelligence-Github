import mongoose, { Document, Schema } from "mongoose";

export interface ICommit extends Document {
  repositoryId: mongoose.Types.ObjectId;
  pullRequestId: mongoose.Types.ObjectId | null;
  githubSha: string;
  authorId: mongoose.Types.ObjectId | null;
  message: string;
  /** Commit message is stored, but raw code diffs are NOT stored */
  committedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const commitSchema = new Schema<ICommit>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    pullRequestId: { type: Schema.Types.ObjectId, ref: "PullRequest", default: null },
    githubSha: { type: String, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "Contributor", default: null },
    message: { type: String, required: true },
    committedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Unique index per design doc
commitSchema.index({ repositoryId: 1, githubSha: 1 }, { unique: true });
// Query index per design doc
commitSchema.index({ repositoryId: 1, committedAt: -1 });

export const Commit = mongoose.model<ICommit>("Commit", commitSchema, "commits");
