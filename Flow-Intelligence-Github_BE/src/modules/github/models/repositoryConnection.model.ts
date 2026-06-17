import mongoose, { Schema, Document } from 'mongoose';

export interface IRepositoryConnection extends Document {
  userId: string;
  providerType: 'github';
  tokenEncrypted?: string;
  installationId?: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

const RepositoryConnectionSchema = new Schema<IRepositoryConnection>(
  {
    userId: { type: String, required: true, index: true },
    providerType: { type: String, enum: ['github'], required: true },
    tokenEncrypted: { type: String },
    installationId: { type: String },
    status: { type: String, enum: ['active', 'inactive', 'pending'], default: 'pending' },
  },
  { timestamps: true }
);

RepositoryConnectionSchema.index({ userId: 1, providerType: 1, status: 1 });

export const RepositoryConnection =
  mongoose.models.RepositoryConnection ||
  mongoose.model<IRepositoryConnection>('RepositoryConnection', RepositoryConnectionSchema);
