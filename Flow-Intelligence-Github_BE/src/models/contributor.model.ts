import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IContributor extends Document {
  repositoryId: Types.ObjectId;
  githubUserId: number;
  login: string;
  displayNameMasked?: string;
  avatarUrlHash?: string;
  type: 'User' | 'Bot';
  createdAt: Date;
  updatedAt: Date;
}

const ContributorSchema = new Schema<IContributor>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'GitHubRepository', required: true, index: true },
    githubUserId: { type: Number, required: true },
    login: { type: String, required: true },
    displayNameMasked: { type: String },
    avatarUrlHash: { type: String },
    type: { type: String, enum: ['User', 'Bot'], default: 'User' },
  },
  { timestamps: true }
);

ContributorSchema.index({ repositoryId: 1, githubUserId: 1 }, { unique: true });
ContributorSchema.index({ repositoryId: 1, login: 1 });

export const Contributor =
  mongoose.models.Contributor || mongoose.model<IContributor>('Contributor', ContributorSchema);
