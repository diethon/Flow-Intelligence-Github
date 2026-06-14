import { Schema, model, Document, Types } from 'mongoose';

export interface ICheckRun extends Document {
  repositoryId: Types.ObjectId;
  pullRequestId?: Types.ObjectId;
  githubCheckId: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: string;
  startedAt: Date;
  completedAt?: Date;
}

const CheckRunSchema = new Schema<ICheckRun>(
  {
    repositoryId: { type: Schema.Types.ObjectId, required: true },
    pullRequestId: { type: Schema.Types.ObjectId },
    githubCheckId: { type: Number, required: true },
    name: { type: String, required: true },
    status: { type: String, enum: ['queued', 'in_progress', 'completed'], required: true },
    conclusion: { type: String },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

CheckRunSchema.index({ githubCheckId: 1 }, { unique: true });
CheckRunSchema.index({ repositoryId: 1, completedAt: -1 });
CheckRunSchema.index({ repositoryId: 1, conclusion: 1, completedAt: -1 });

export const CheckRun = model<ICheckRun>('CheckRun', CheckRunSchema);
