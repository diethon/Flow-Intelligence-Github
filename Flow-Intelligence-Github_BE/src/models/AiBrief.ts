import mongoose, { Document, Schema } from "mongoose";

export type AiBriefStatus = "generating" | "completed" | "failed" | "fallback";
export type AiBriefConfidence = "high" | "medium" | "low";

/** A single item in the brief — embedded in AiBrief */
export interface IBriefItem {
  /** "risk_summary" | "recommendation" | "observation" */
  type: string;
  title: string;
  detail: string;
  severity: "high" | "medium" | "low" | "info";
  /** References to EvidenceCard IDs backing this item */
  evidenceCardIds: mongoose.Types.ObjectId[];
}

export interface IAiBrief extends Document {
  repositoryId: mongoose.Types.ObjectId;
  windowStart: Date;
  windowEnd: Date;
  status: AiBriefStatus;
  summary: string;
  confidence: AiBriefConfidence;
  limitations: string[];
  /** Embedded brief items — read as one document */
  items: IBriefItem[];
  createdBy: mongoose.Types.ObjectId | null;
  /** True if produced by deterministic fallback, not AI */
  isFallback: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const briefItemSchema = new Schema<IBriefItem>(
  {
    type: { type: String, required: true },
    title: { type: String, required: true },
    detail: { type: String, required: true },
    severity: { type: String, enum: ["high", "medium", "low", "info"], default: "info" },
    evidenceCardIds: [{ type: Schema.Types.ObjectId, ref: "EvidenceCard" }],
  },
  { _id: false }
);

const aiBriefSchema = new Schema<IAiBrief>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    windowStart: { type: Date, required: true },
    windowEnd: { type: Date, required: true },
    status: {
      type: String,
      enum: ["generating", "completed", "failed", "fallback"],
      default: "generating",
    },
    summary: { type: String, default: "" },
    confidence: { type: String, enum: ["high", "medium", "low"], default: "medium" },
    limitations: [{ type: String }],
    items: { type: [briefItemSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isFallback: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Query index per design doc
aiBriefSchema.index({ repositoryId: 1, createdAt: -1 });

export const AiBrief = mongoose.models.AiBrief || mongoose.model<IAiBrief>("AiBrief", aiBriefSchema, "aiBriefs");
