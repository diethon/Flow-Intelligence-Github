import mongoose, { Document, Schema } from "mongoose";

export type WebhookEventType =
  | "pull_request"
  | "pull_request_review"
  | "pull_request_review_comment"
  | "check_run"
  | "check_suite"
  | "push"
  | "issues";

export type WebhookEventStatus =
  | "pending"
  | "processed"
  | "duplicate_ignored"
  | "failed"
  | "skipped";

export interface IWebhookEvent extends Document {
  repositoryId: mongoose.Types.ObjectId;
  githubDeliveryId: string;
  eventType: string;
  action?: string;
  status: WebhookEventStatus;
  payload: Record<string, unknown>;
  receivedAt: Date;
  processedAt: Date | null;
  processed?: boolean;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const webhookEventSchema = new Schema<IWebhookEvent>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    githubDeliveryId: { type: String, required: true },
    eventType: {
      type: String,
      required: true,
    },
    action: { type: String },
    status: {
      type: String,
      enum: ["pending", "processed", "duplicate_ignored", "failed", "skipped"],
      default: "pending",
    },
    payload: { type: Schema.Types.Mixed, default: {} },
    receivedAt: { type: Date, required: true, default: Date.now },
    processedAt: { type: Date, default: null },
    processed: { type: Boolean, default: false },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true }
);

// Unique index per design doc — prevents duplicate deliveries
webhookEventSchema.index({ githubDeliveryId: 1 }, { unique: true, sparse: true });
// Query index per design doc
webhookEventSchema.index({ repositoryId: 1, eventType: 1, receivedAt: -1 });

export const WebhookEvent = mongoose.models.WebhookEvent || mongoose.model<IWebhookEvent>(
  "WebhookEvent",
  webhookEventSchema,
  "webhookEvents"
);
