import mongoose, { Document, Schema } from "mongoose";

export interface IReviewRequest extends Document {
  repositoryId: mongoose.Types.ObjectId;
  pullRequestId: mongoose.Types.ObjectId;
  requestedReviewerId?: mongoose.Types.ObjectId | null;
  githubUserId: number;
  userLogin: string;
  userAvatarUrl?: string;
  requestedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reviewRequestSchema = new Schema<IReviewRequest>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    pullRequestId: { type: Schema.Types.ObjectId, ref: "PullRequest", required: true },
    requestedReviewerId: { type: Schema.Types.ObjectId, ref: "Contributor", default: null },
    githubUserId: { type: Number, required: true },
    userLogin: { type: String, required: true },
    userAvatarUrl: { type: String },
    requestedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Query indexes per design doc
reviewRequestSchema.index({ pullRequestId: 1, requestedAt: 1 });
reviewRequestSchema.index({ repositoryId: 1, requestedReviewerId: 1 });

export const ReviewRequest = mongoose.models.ReviewRequest || mongoose.model<IReviewRequest>("ReviewRequest", reviewRequestSchema, "reviewRequests");
