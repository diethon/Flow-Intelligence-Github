import mongoose, { Document, Schema } from "mongoose";

export type EvidenceCardSeverity = "high" | "medium" | "low";
export type EvidenceCardConfidence = "high" | "medium" | "low";
export type EvidenceCardSourceType = "rule_based" | "ml_prediction";

/** A single piece of evidence linking to a GitHub entity */
export interface IEvidenceItem {
  entityType: "pull_request" | "review" | "check_run" | "contributor";
  entityId: mongoose.Types.ObjectId;
  /** Human-readable label, e.g. "#42 feat: add auth" */
  label: string;
  /** Optional external GitHub URL */
  githubUrl: string | null;
}

export interface IEvidenceCard extends Document {
  repositoryId: mongoose.Types.ObjectId;
  /**
   * Exactly one of riskEventId or predictionId is set, identified by sourceType.
   * riskEventId → rule_based, predictionId → ml_prediction
   */
  riskEventId: mongoose.Types.ObjectId | null;
  predictionId: mongoose.Types.ObjectId | null;
  sourceType: EvidenceCardSourceType;
  title: string;
  severity: EvidenceCardSeverity;
  summary: string;
  suggestedAction: string;
  confidence: EvidenceCardConfidence;
  limitation: string;
  /** Embedded evidence items — small, display-ready */
  evidence: IEvidenceItem[];
  createdAt: Date;
  updatedAt: Date;
}

const evidenceItemSchema = new Schema<IEvidenceItem>(
  {
    entityType: {
      type: String,
      enum: ["pull_request", "review", "check_run", "contributor"],
      required: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: true },
    label: { type: String, required: true },
    githubUrl: { type: String, default: null },
  },
  { _id: false }
);

const evidenceCardSchema = new Schema<IEvidenceCard>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    riskEventId: { type: Schema.Types.ObjectId, ref: "RiskEvent", default: null },
    predictionId: { type: Schema.Types.ObjectId, ref: "PrDelayPrediction", default: null },
    sourceType: {
      type: String,
      enum: ["rule_based", "ml_prediction"],
      required: true,
    },
    title: { type: String, required: true },
    severity: { type: String, enum: ["high", "medium", "low"], required: true },
    summary: { type: String, required: true },
    suggestedAction: { type: String, required: true },
    confidence: { type: String, enum: ["high", "medium", "low"], required: true },
    limitation: { type: String, default: "" },
    evidence: { type: [evidenceItemSchema], default: [] },
  },
  { timestamps: true }
);

// Query index per design doc
evidenceCardSchema.index({ repositoryId: 1, severity: 1, createdAt: -1 });

export const EvidenceCard = mongoose.model<IEvidenceCard>("EvidenceCard", evidenceCardSchema, "evidenceCards");
