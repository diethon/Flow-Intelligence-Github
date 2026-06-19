import mongoose, { Document, Schema } from "mongoose";

export interface IPullRequest extends Document {
  repositoryId: mongoose.Types.ObjectId;
  githubPrId: number;
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  isDraft: boolean;
  authorId: mongoose.Types.ObjectId;
  createdAt: Date;
  readyForReviewAt: Date | null;
  mergedAt: Date | null;
  closedAt: Date | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  updatedAt: Date;
}

const pullRequestSchema = new Schema<IPullRequest>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    githubPrId: { type: Number, required: true },
    number: { type: Number, required: true },
    title: { type: String, required: true },
    state: { type: String, enum: ["open", "closed", "merged"], required: true },
    isDraft: { type: Boolean, default: false },
    authorId: { type: Schema.Types.ObjectId, ref: "Contributor", required: true },
    readyForReviewAt: { type: Date, default: null },
    mergedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    additions: { type: Number, default: 0 },
    deletions: { type: Number, default: 0 },
    changedFiles: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Unique index per design doc
pullRequestSchema.index({ repositoryId: 1, number: 1 }, { unique: true });
// Query indexes per design doc
pullRequestSchema.index({ repositoryId: 1, createdAt: -1 });
pullRequestSchema.index({ repositoryId: 1, state: 1 });
pullRequestSchema.index({ repositoryId: 1, mergedAt: -1 });
pullRequestSchema.index({ repositoryId: 1, authorId: 1 });

export const PullRequest = mongoose.model<IPullRequest>("PullRequest", pullRequestSchema, "pullRequests");
