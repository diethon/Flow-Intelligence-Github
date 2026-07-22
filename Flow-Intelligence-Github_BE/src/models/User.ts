import mongoose, { Document, Schema } from "mongoose";

export type UserRole = "admin" | "manager" | "viewer";

export interface IUser extends Document {
  githubId: string;
  username: string;
  email: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
  name?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    githubId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    avatarUrl: { type: String },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    name: { type: String },
    role: { type: String, enum: ["admin", "manager", "viewer"], default: "manager" },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model<IUser>("User", userSchema, "users");
