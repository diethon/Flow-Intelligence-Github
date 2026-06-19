import mongoose, { Document, Schema } from "mongoose";

export type AuditAction =
  | "repository_connected"
  | "repository_disconnected"
  | "sync_completed"
  | "sync_failed"
  | "brief_generated"
  | "privacy_settings_changed"
  | "sample_data_imported";

export interface IAuditEvent extends Document {
  userId: mongoose.Types.ObjectId | null;
  repositoryId: mongoose.Types.ObjectId | null;
  action: AuditAction;
  detail: Record<string, unknown>;
  createdAt: Date;
}

const auditEventSchema = new Schema<IAuditEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", default: null },
    action: {
      type: String,
      enum: [
        "repository_connected",
        "repository_disconnected",
        "sync_completed",
        "sync_failed",
        "brief_generated",
        "privacy_settings_changed",
        "sample_data_imported",
      ],
      required: true,
    },
    detail: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Query indexes per design doc
auditEventSchema.index({ repositoryId: 1, createdAt: -1 });
auditEventSchema.index({ userId: 1, createdAt: -1 });

export const AuditEvent = mongoose.model<IAuditEvent>("AuditEvent", auditEventSchema, "auditEvents");
