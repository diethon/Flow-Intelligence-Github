import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['admin', 'member', 'viewer'], required: true, default: 'member' },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 }, { unique: true });

export const User = model<IUser>('User', UserSchema);
