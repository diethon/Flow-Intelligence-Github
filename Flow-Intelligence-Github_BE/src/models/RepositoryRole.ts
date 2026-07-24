import mongoose, { Schema, Document } from "mongoose";

export interface IRepositoryRole extends Document {
  repositoryId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  githubUsername: string;
  role: "leader" | "dev" | "viewer";
  cachedUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}

const repositoryRoleSchema = new Schema<IRepositoryRole>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    githubUsername: { type: String, required: true },
    role: { type: String, enum: ["leader", "dev", "viewer"], required: true },
    cachedUntil: { type: Date, required: true }
  },
  { timestamps: true }
);

// Unique compound index to prevent duplicate memberships
repositoryRoleSchema.index({ repositoryId: 1, userId: 1 }, { unique: true });
repositoryRoleSchema.index({ repositoryId: 1, role: 1 });

export const RepositoryRole = mongoose.models.RepositoryRole || 
  mongoose.model<IRepositoryRole>("RepositoryRole", repositoryRoleSchema, "repositoryRole");
