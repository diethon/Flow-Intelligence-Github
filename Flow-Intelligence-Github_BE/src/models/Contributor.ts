import mongoose, { Document, Schema } from "mongoose";

export interface IContributor extends Document {
  repositoryId: mongoose.Types.ObjectId;
  githubUserId: number;
  login: string;
  /** Pseudonymized display name shown when privacy masking is enabled */
  pseudoLogin: string;
  displayName: string;
  avatarUrl: string;
  isPseudonymized: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const contributorSchema = new Schema<IContributor>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    githubUserId: { type: Number, required: true },
    login: { type: String, required: true },
    pseudoLogin: { type: String, default: "" },
    displayName: { type: String, required: true },
    avatarUrl: { type: String, default: "" },
    isPseudonymized: { type: Boolean, default: false },
  },
  { timestamps: true }
);

contributorSchema.index({ repositoryId: 1, githubUserId: 1 }, { unique: true });

export const Contributor = mongoose.model<IContributor>("Contributor", contributorSchema, "contributors");
