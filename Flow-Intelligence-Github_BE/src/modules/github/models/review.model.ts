import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IReview extends Document {
  pullRequestId: Types.ObjectId;
  repositoryId: Types.ObjectId;
  githubReviewId: number;
  githubUserId: number;
  userLogin: string;
  userAvatarUrl?: string;
  state: 'PENDING' | 'COMMENTED' | 'APPROVED' | 'CHANGES_REQUESTED' | 'DISMISSED';
  body?: string;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    pullRequestId: { type: Schema.Types.ObjectId, ref: 'PullRequest', required: true, index: true },
    repositoryId: { type: Schema.Types.ObjectId, ref: 'GitHubRepository', required: true, index: true },
    githubReviewId: { type: Number, required: true, unique: true },
    githubUserId: { type: Number, required: true },
    userLogin: { type: String, required: true },
    userAvatarUrl: { type: String },
    state: {
      type: String,
      enum: ['PENDING', 'COMMENTED', 'APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'],
      required: true,
    },
    body: { type: String },
    submittedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

ReviewSchema.index({ pullRequestId: 1, githubReviewId: 1 }, { unique: true });
ReviewSchema.index({ repositoryId: 1, githubUserId: 1 });

export const Review = mongoose.models.Review || mongoose.model<IReview>('Review', ReviewSchema);
