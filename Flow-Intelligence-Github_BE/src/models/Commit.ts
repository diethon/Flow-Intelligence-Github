import mongoose, { Document, Schema } from "mongoose";

/**
 * Canonical Commit model (single registration for the `commits` collection).
 * `./commit.model` is a thin re-export of this file so both import styles share
 * one schema — previously two divergent schemas fought over the "Commit" model
 * name and Mongoose strict mode silently dropped author fields on write.
 *
 * Author identity is stored two ways: `authorGithubId`/`authorLogin` come from
 * the GitHub API (author may be an unlinked/bot account, so id can be absent but
 * a git author name is kept in `authorLogin`). `authorId` is a legacy Contributor
 * ref, usually null.
 */
export interface ICommit extends Document {
  repositoryId: mongoose.Types.ObjectId;
  pullRequestId: mongoose.Types.ObjectId | null;
  githubSha: string;
  authorId: mongoose.Types.ObjectId | null;
  authorGithubId?: number;
  authorLogin?: string;
  /** Commit message is stored, but raw code diffs are NOT stored */
  message?: string;
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
    authorGithubId: { type: Number },
    authorLogin: { type: String },
    message: { type: String },
    committedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Unique index per design doc
commitSchema.index({ repositoryId: 1, githubSha: 1 }, { unique: true });
// Query index per design doc
commitSchema.index({ repositoryId: 1, committedAt: -1 });

// Guard against re-registration / import-order OverwriteModelError.
export const Commit =
  (mongoose.models.Commit as mongoose.Model<ICommit>) ||
  mongoose.model<ICommit>("Commit", commitSchema, "commits");
