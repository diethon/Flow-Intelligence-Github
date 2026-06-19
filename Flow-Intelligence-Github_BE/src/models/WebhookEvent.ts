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
  /** GitHub delivery ID — used for deduplication */
  githubDeliveryId: string;
  eventType: WebhookEventType;
  status: WebhookEventStatus;
  /** Minimal payload stored for dedupe/audit — no raw code or sensitive bodies */
  payload: Record<string, unknown>;
  receivedAt: Date;
  processedAt: Date | null;
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
      enum: [
        "pull_request",
        "pull_request_review",
        "pull_request_review_comment",
        "check_run",
        "check_suite",
        "push",
        "issues",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processed", "duplicate_ignored", "failed", "skipped"],
      default: "pending",
    },
    payload: { type: Schema.Types.Mixed, default: {} },
    receivedAt: { type: Date, required: true, default: Date.now },
    processedAt: { type: Date, default: null },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true }
);

// Unique index per design doc — prevents duplicate deliveries
webhookEventSchema.index({ githubDeliveryId: 1 }, { unique: true, sparse: true });
// Query index per design doc
webhookEventSchema.index({ repositoryId: 1, eventType: 1, receivedAt: -1 });

export const WebhookEvent = mongoose.model<IWebhookEvent>(
  "WebhookEvent",
  webhookEventSchema,
  "webhookEvents"
);
