import { Schema, model, Document, Types } from 'mongoose';

export type AuditAction =
  | 'repository_connected'
  | 'repository_disconnected'
  | 'sync_completed'
  | 'sync_failed'
  | 'brief_generated'
  | 'privacy_changed';

export interface IAuditEvent extends Document {
  userId: Types.ObjectId;
  repositoryId?: Types.ObjectId;
  action: AuditAction;
  details?: Record<string, unknown>;
  createdAt: Date;
}

const AuditEventSchema = new Schema<IAuditEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository' },
    action: {
      type: String,
      enum: [
        'repository_connected',
        'repository_disconnected',
        'sync_completed',
        'sync_failed',
        'brief_generated',
        'privacy_changed',
      ],
      required: true,
    },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

AuditEventSchema.index({ repositoryId: 1, createdAt: -1 });
AuditEventSchema.index({ userId: 1, createdAt: -1 });

export const AuditEvent = model<IAuditEvent>('AuditEvent', AuditEventSchema);
