import mongoose, { Document, Schema } from "mongoose";

export interface IReview extends Document {
  repositoryId: mongoose.Types.ObjectId;
  pullRequestId: mongoose.Types.ObjectId;
  githubReviewId: number;
  reviewerId: mongoose.Types.ObjectId;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED";
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    pullRequestId: { type: Schema.Types.ObjectId, ref: "PullRequest", required: true },
    githubReviewId: { type: Number, required: true },
    reviewerId: { type: Schema.Types.ObjectId, ref: "Contributor", required: true },
    state: {
      type: String,
      enum: ["APPROVED", "CHANGES_REQUESTED", "COMMENTED", "DISMISSED"],
      required: true,
    },
    submittedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Unique index per design doc
reviewSchema.index({ githubReviewId: 1 }, { unique: true, sparse: true });
// Query indexes per design doc
reviewSchema.index({ pullRequestId: 1, submittedAt: 1 });
reviewSchema.index({ repositoryId: 1, reviewerId: 1, submittedAt: -1 });

export const Review = mongoose.model<IReview>("Review", reviewSchema, "reviews");
