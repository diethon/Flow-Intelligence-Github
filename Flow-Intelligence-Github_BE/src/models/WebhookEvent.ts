import { Schema, model, Document, Types } from 'mongoose';

export interface IWebhookEvent extends Document {
  repositoryId: Types.ObjectId;
  githubDeliveryId: string;
  eventType: string;
  action?: string;
  receivedAt: Date;
  processed: boolean;
  processedAt?: Date;
  errorMessage?: string;
}

const WebhookEventSchema = new Schema<IWebhookEvent>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    githubDeliveryId: { type: String, required: true },
    eventType: { type: String, required: true },
    action: { type: String },
    receivedAt: { type: Date, required: true, default: Date.now },
    processed: { type: Boolean, required: true, default: false },
    processedAt: { type: Date },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

WebhookEventSchema.index({ githubDeliveryId: 1 }, { unique: true, sparse: true });
WebhookEventSchema.index({ repositoryId: 1, eventType: 1, receivedAt: -1 });
// TTL: auto-delete after 30 days
WebhookEventSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const WebhookEvent = model<IWebhookEvent>('WebhookEvent', WebhookEventSchema);
