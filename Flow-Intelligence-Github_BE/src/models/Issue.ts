import { Schema, model, Document, Types } from 'mongoose';

export interface IIssue extends Document {
  repositoryId: Types.ObjectId;
  githubIssueId: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  authorId: Types.ObjectId;
  createdAt: Date;
  closedAt?: Date;
}

const IssueSchema = new Schema<IIssue>(
  {
    repositoryId: { type: Schema.Types.ObjectId, required: true },
    githubIssueId: { type: Number, required: true },
    number: { type: Number, required: true },
    title: { type: String, required: true },
    state: { type: String, enum: ['open', 'closed'], required: true },
    authorId: { type: Schema.Types.ObjectId, required: true },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

IssueSchema.index({ repositoryId: 1, state: 1, createdAt: -1 });

export const Issue = model<IIssue>('Issue', IssueSchema);
