import mongoose, { Document, Schema } from "mongoose";

export type EvidenceCardSeverity = "high" | "medium" | "low";
export type EvidenceCardConfidence = "high" | "medium" | "low";
/**
 * Exactly one source per card, per CLAUDE.md §7.6:
 *   risk_event → rule-based (riskEventId set)
 *   prediction → ML        (predictionId set)
 */
export type EvidenceCardSourceType = "risk_event" | "prediction";

/**
 * A single piece of evidence linking to a GitHub entity. Display-ready fields
 * (`sourceLabel`, `sourceUrl`, `summary`) are the canonical Evidence Card
 * contract consumed by the Risk & Evidence detail page. `entityType` is kept
 * open (string) because it spans pull_request | issue | commit | check_run |
 * review | contributor across the rule-based and ML sources.
 */
export interface IEvidenceItem {
  entityType: string;
  entityId: mongoose.Types.ObjectId;
  /** Human-readable label, e.g. "PR #42" */
  sourceLabel: string;
  /** External GitHub URL (may be empty when the entity has no direct URL) */
  sourceUrl: string;
  /** Short, redacted summary of why this entity is evidence */
  summary: string;
}

export interface IEvidenceCard extends Document {
  repositoryId: mongoose.Types.ObjectId;
  /** Exactly one of riskEventId / predictionId is set, identified by sourceType. */
  riskEventId?: mongoose.Types.ObjectId | null;
  predictionId?: mongoose.Types.ObjectId | null;
  sourceType: EvidenceCardSourceType;
  title: string;
  severity: EvidenceCardSeverity;
  summary: string;
  suggestedAction: string;
  confidence: EvidenceCardConfidence;
  limitation: string;
  /** Embedded evidence items — small, display-ready. A card is never persisted empty. */
  evidence: IEvidenceItem[];
  createdAt: Date;
  updatedAt: Date;
}

const evidenceItemSchema = new Schema<IEvidenceItem>(
  {
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    sourceLabel: { type: String, required: true },
    sourceUrl: { type: String, default: "" },
    summary: { type: String, default: "" },
  },
  { _id: false }
);

const evidenceCardSchema = new Schema<IEvidenceCard>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true, index: true },
    riskEventId: { type: Schema.Types.ObjectId, ref: "RiskEvent", default: null, index: true },
    predictionId: { type: Schema.Types.ObjectId, ref: "PrDelayPrediction", default: null, index: true },
    sourceType: { type: String, enum: ["risk_event", "prediction"], required: true },
    title: { type: String, required: true },
    severity: { type: String, enum: ["high", "medium", "low"], required: true },
    summary: { type: String, required: true },
    suggestedAction: { type: String, required: true },
    confidence: { type: String, enum: ["high", "medium", "low"], required: true },
    limitation: { type: String, default: "" },
    evidence: { type: [evidenceItemSchema], required: true },
  },
  { timestamps: true }
);

// Query index per design doc (repositoryId is the partition key).
evidenceCardSchema.index({ repositoryId: 1, severity: 1, createdAt: -1 });

export const EvidenceCard =
  mongoose.models.EvidenceCard ||
  mongoose.model<IEvidenceCard>("EvidenceCard", evidenceCardSchema, "evidenceCards");
