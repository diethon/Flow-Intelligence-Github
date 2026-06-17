import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IReviewRequest extends Document {
  pullRequestId: Types.ObjectId;
  repositoryId: Types.ObjectId;
  githubUserId: number;
  userLogin: string;
  userAvatarUrl?: string;
  requestedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewRequestSchema = new Schema<IReviewRequest>(
  {
    pullRequestId: { type: Schema.Types.ObjectId, ref: 'PullRequest', required: true, index: true },
    repositoryId: { type: Schema.Types.ObjectId, ref: 'GitHubRepository', required: true, index: true },
    githubUserId: { type: Number, required: true },
    userLogin: { type: String, required: true },
    userAvatarUrl: { type: String },
    requestedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

ReviewRequestSchema.index({ pullRequestId: 1, githubUserId: 1 }, { unique: true });
ReviewRequestSchema.index({ repositoryId: 1, userLogin: 1 });

export const ReviewRequest =
  mongoose.models.ReviewRequest || mongoose.model<IReviewRequest>('ReviewRequest', ReviewRequestSchema);
