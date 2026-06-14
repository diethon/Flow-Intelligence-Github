import { Schema, model, Document, Types } from 'mongoose';

export interface IContributor extends Document {
  repositoryId: Types.ObjectId;
  githubUserId: number;
  login: string;
  displayName: string;
  avatarUrl?: string;
}

const ContributorSchema = new Schema<IContributor>(
  {
    repositoryId: { type: Schema.Types.ObjectId, required: true },
    githubUserId: { type: Number, required: true },
    login: { type: String, required: true },
    displayName: { type: String, required: true },
    avatarUrl: { type: String },
  },
  { timestamps: true }
);

ContributorSchema.index({ repositoryId: 1, githubUserId: 1 });
ContributorSchema.index({ githubUserId: 1 }, { unique: true });

export const Contributor = model<IContributor>('Contributor', ContributorSchema);
