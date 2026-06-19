import mongoose, { Document, Schema } from "mongoose";

export interface IReviewRequest extends Document {
  repositoryId: mongoose.Types.ObjectId;
  pullRequestId: mongoose.Types.ObjectId;
  requestedReviewerId: mongoose.Types.ObjectId;
  requestedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reviewRequestSchema = new Schema<IReviewRequest>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    pullRequestId: { type: Schema.Types.ObjectId, ref: "PullRequest", required: true },
    requestedReviewerId: { type: Schema.Types.ObjectId, ref: "Contributor", required: true },
    requestedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Query indexes per design doc
reviewRequestSchema.index({ pullRequestId: 1, requestedAt: 1 });
reviewRequestSchema.index({ repositoryId: 1, requestedReviewerId: 1 });

export const ReviewRequest = mongoose.model<IReviewRequest>("ReviewRequest", reviewRequestSchema, "reviewRequests");
