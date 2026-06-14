import { Schema, model, Document, Types } from 'mongoose';

export interface IGitHubConnection extends Document {
  userId: Types.ObjectId;
  providerType: 'oauth' | 'app';
  installationId?: string;
  tokenEncrypted: string; // NEVER store raw token
  status: 'active' | 'revoked' | 'expired';
  createdAt: Date;
  revokedAt?: Date;
}

const GitHubConnectionSchema = new Schema<IGitHubConnection>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    providerType: { type: String, enum: ['oauth', 'app'], required: true },
    installationId: { type: String },
    tokenEncrypted: { type: String, required: true },
    status: { type: String, enum: ['active', 'revoked', 'expired'], required: true, default: 'active' },
    revokedAt: { type: Date },
  },
  { timestamps: true }
);

GitHubConnectionSchema.index({ userId: 1, status: 1 });

export const GitHubConnection = model<IGitHubConnection>('GitHubConnection', GitHubConnectionSchema);
