import { Schema, model, Document, Types } from 'mongoose';

export interface IAiPromptLog extends Document {
  briefId: Types.ObjectId;
  promptPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
  tokensUsed: number;
  isRedacted: boolean;
  createdAt: Date;
}

const AiPromptLogSchema = new Schema<IAiPromptLog>(
  {
    briefId: { type: Schema.Types.ObjectId, ref: 'AiBrief', required: true },
    promptPayload: { type: Schema.Types.Mixed, required: true },
    responsePayload: { type: Schema.Types.Mixed, required: true },
    tokensUsed: { type: Number, required: true, default: 0 },
    isRedacted: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

AiPromptLogSchema.index({ briefId: 1 });
// TTL: auto-delete after 30 days
AiPromptLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const AiPromptLog = model<IAiPromptLog>('AiPromptLog', AiPromptLogSchema);
