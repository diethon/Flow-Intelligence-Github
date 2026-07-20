import mongoose, { Document, Schema } from "mongoose";

export interface IRepository extends Document {
  connectionId: mongoose.Types.ObjectId | null;
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  lastSyncedAt: Date | null;
  webhookId?: number | null;
  webhookUrl?: string | null;
  slackWebhookUrl?: string | null;
  scheduleEnabled?: boolean;
  scheduleDay?: string;
  scheduleTime?: string;
  createdAt: Date;
  updatedAt: Date;
}

const repositorySchema = new Schema<IRepository>(
  {
    connectionId: { type: Schema.Types.ObjectId, ref: "GitHubConnection", default: null },
    githubRepoId: { type: Number, required: true, unique: true },
    owner: { type: String, required: true },
    name: { type: String, required: true },
    fullName: { type: String, required: true },
    defaultBranch: { type: String, default: "main" },
    isPrivate: { type: Boolean, default: false },
    lastSyncedAt: { type: Date, default: null },
    webhookId: { type: Number, default: null },
    webhookUrl: { type: String, default: null },
    slackWebhookUrl: { type: String, default: null },
    scheduleEnabled: { type: Boolean, default: true },
    scheduleDay: { type: String, default: "FRIDAY" },
    scheduleTime: { type: String, default: "17:00" },
  },
  { timestamps: true }
);

// Query index: look up repos by connection
repositorySchema.index({ connectionId: 1 });

export const Repository = mongoose.models.Repository || mongoose.model<IRepository>("Repository", repositorySchema, "repositories");
