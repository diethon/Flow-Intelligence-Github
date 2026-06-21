import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IGitHubRepository extends Document {
  connectionId: Types.ObjectId;
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  webhookId?: number;
  webhookUrl?: string;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GitHubRepositorySchema = new Schema<IGitHubRepository>(
  {
    connectionId: { type: Schema.Types.ObjectId, ref: 'RepositoryConnection', required: true, index: true },
    githubRepoId: { type: Number, required: true, unique: true },
    owner: { type: String, required: true },
    name: { type: String, required: true },
    fullName: { type: String, required: true, unique: true },
    defaultBranch: { type: String, default: 'main' },
    isPrivate: { type: Boolean, default: false },
    webhookId: { type: Number },
    webhookUrl: { type: String },
    lastSyncedAt: { type: Date },
  },
  { timestamps: true }
);

export const GitHubRepository =
  mongoose.models.GitHubRepository ||
  mongoose.model<IGitHubRepository>('GitHubRepository', GitHubRepositorySchema);
