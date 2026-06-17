import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookEvent extends Document {
  repositoryId: string;
  githubDeliveryId: string;
  eventType: string;
  action?: string;
  payload: Record<string, unknown>;
  receivedAt: Date;
  processed: boolean;
  processedAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookEventSchema = new Schema<IWebhookEvent>(
  {
    repositoryId: { type: String, required: true, index: true },
    githubDeliveryId: { type: String, required: true, unique: true },
    eventType: { type: String, required: true },
    action: { type: String },
    payload: { type: Schema.Types.Mixed },
    receivedAt: { type: Date, required: true },
    processed: { type: Boolean, default: false },
    processedAt: { type: Date },
    error: { type: String },
  },
  { timestamps: true }
);

export const WebhookEvent =
  mongoose.models.WebhookEvent ||
  mongoose.model<IWebhookEvent>('WebhookEvent', WebhookEventSchema);
