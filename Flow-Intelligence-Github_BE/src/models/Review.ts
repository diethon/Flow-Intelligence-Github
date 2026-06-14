import { Schema, model, Document, Types } from 'mongoose';

export interface IReview extends Document {
  repositoryId: Types.ObjectId;
  pullRequestId: Types.ObjectId;
  githubReviewId: number;
  reviewerId: Types.ObjectId;
  state: 'approved' | 'changes_requested' | 'commented' | 'pending' | 'dismissed';
  submittedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    repositoryId: { type: Schema.Types.ObjectId, required: true },
    pullRequestId: { type: Schema.Types.ObjectId, required: true },
    githubReviewId: { type: Number, required: true },
    reviewerId: { type: Schema.Types.ObjectId, required: true },
    state: {
      type: String,
      enum: ['approved', 'changes_requested', 'commented', 'pending', 'dismissed'],
      required: true,
    },
    submittedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

ReviewSchema.index({ githubReviewId: 1 }, { unique: true });
ReviewSchema.index({ pullRequestId: 1, submittedAt: 1 });
ReviewSchema.index({ repositoryId: 1, reviewerId: 1, submittedAt: -1 });

export const Review = model<IReview>('Review', ReviewSchema);
