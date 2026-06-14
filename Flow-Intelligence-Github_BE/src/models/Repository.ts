import { Schema, model, Document, Types } from 'mongoose';

export interface IRepository extends Document {
  connectionId: Types.ObjectId;
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  lastSyncedAt?: Date;
}

const RepositorySchema = new Schema<IRepository>(
  {
    connectionId: { type: Schema.Types.ObjectId, ref: 'GitHubConnection', required: true },
    githubRepoId: { type: Number, required: true },
    owner: { type: String, required: true },
    name: { type: String, required: true },
    fullName: { type: String, required: true },
    defaultBranch: { type: String, required: true, default: 'main' },
    isPrivate: { type: Boolean, required: true, default: false },
    lastSyncedAt: { type: Date },
  },
  { timestamps: true }
);

RepositorySchema.index({ githubRepoId: 1 }, { unique: true });
RepositorySchema.index({ connectionId: 1 });

export const Repository = model<IRepository>('Repository', RepositorySchema);
