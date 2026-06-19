import mongoose, { Document, Schema } from "mongoose";

export type UserRole = "admin" | "manager" | "viewer";

export interface IUser extends Document {
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["admin", "manager", "viewer"], default: "manager" },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema, "users");
