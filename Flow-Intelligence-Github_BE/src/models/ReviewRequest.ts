import { Schema, model, Document, Types } from 'mongoose';

export interface IReviewRequest extends Document {
  pullRequestId: Types.ObjectId;
  requestedReviewerId: Types.ObjectId;
  requestedAt: Date;
}

const ReviewRequestSchema = new Schema<IReviewRequest>(
  {
    pullRequestId: { type: Schema.Types.ObjectId, required: true },
    requestedReviewerId: { type: Schema.Types.ObjectId, required: true },
    requestedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

ReviewRequestSchema.index({ pullRequestId: 1, requestedAt: 1 });

export const ReviewRequest = model<IReviewRequest>('ReviewRequest', ReviewRequestSchema);
