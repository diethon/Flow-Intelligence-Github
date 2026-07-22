import mongoose, { Document, Schema } from "mongoose";

export interface IReview extends Document {
  repositoryId: mongoose.Types.ObjectId;
  pullRequestId: mongoose.Types.ObjectId;
  githubReviewId: number;
  reviewerId: mongoose.Types.ObjectId;
  githubUserId: number;
  userLogin: string;
  userAvatarUrl?: string;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
  body?: string;
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
    githubUserId: { type: Number, required: true },
    userLogin: { type: String, required: true },
    userAvatarUrl: { type: String },
    state: {
      type: String,
      enum: ["APPROVED", "CHANGES_REQUESTED", "COMMENTED", "DISMISSED", "PENDING"],
      required: true,
    },
    body: { type: String },
    submittedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Unique index per design doc
reviewSchema.index({ githubReviewId: 1 }, { unique: true, sparse: true });
// Query indexes per design doc
reviewSchema.index({ pullRequestId: 1, submittedAt: 1 });
reviewSchema.index({ repositoryId: 1, reviewerId: 1, submittedAt: -1 });

export const Review = mongoose.models.Review || mongoose.model<IReview>("Review", reviewSchema, "reviews");
