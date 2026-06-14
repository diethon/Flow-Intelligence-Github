import { Schema, model, Document, Types } from 'mongoose';

export interface ICommit extends Document {
  repositoryId: Types.ObjectId;
  githubSha: string;
  message: string;
  authorId: Types.ObjectId;
  committedAt: Date;
}

const CommitSchema = new Schema<ICommit>(
  {
    repositoryId: { type: Schema.Types.ObjectId, required: true },
    githubSha: { type: String, required: true },
    message: { type: String, required: true },
    authorId: { type: Schema.Types.ObjectId, required: true },
    committedAt: { type: Date, required: true },
    // NOT stored: patch, files[].patch, raw code content
  },
  { timestamps: true }
);

CommitSchema.index({ repositoryId: 1, githubSha: 1 }, { unique: true });

export const Commit = model<ICommit>('Commit', CommitSchema);
