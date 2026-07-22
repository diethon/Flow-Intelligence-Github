import mongoose, { Document, Schema } from "mongoose";

export interface IAiPromptLog extends Document {
  briefId: mongoose.Types.ObjectId;
  /** Structured prompt payload sent to AI — must never contain raw code/comments */
  promptPayload: Record<string, unknown>;
  /** Whether contributor names were pseudonymized before sending */
  wasRedacted: boolean;
  /** AI provider response (may be null if call failed) */
  responsePayload: Record<string, unknown> | null;
  /** AI provider used, e.g. "openai" */
  provider: string;
  /** Model name/version used, e.g. "gpt-4o" */
  modelName: string;
  durationMs: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const aiPromptLogSchema = new Schema<IAiPromptLog>(
  {
    briefId: { type: Schema.Types.ObjectId, ref: "AiBrief", required: true },
    promptPayload: { type: Schema.Types.Mixed, required: true },
    wasRedacted: { type: Boolean, default: false },
    responsePayload: { type: Schema.Types.Mixed, default: null },
    provider: { type: String, default: "openai" },
    modelName: { type: String, default: "" },
    durationMs: { type: Number, default: null },
  },
  { timestamps: true }
);

// Query index per design doc
aiPromptLogSchema.index({ briefId: 1 });

export const AiPromptLog = mongoose.models.AiPromptLog || mongoose.model<IAiPromptLog>("AiPromptLog", aiPromptLogSchema, "aiPromptLogs");
