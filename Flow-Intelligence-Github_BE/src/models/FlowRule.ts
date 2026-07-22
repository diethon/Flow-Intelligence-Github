import mongoose, { Document, Schema } from "mongoose";

export type RuleCode = "R1" | "R2" | "R3" | "R4" | "R5";
export type RuleSeverityLevel = "high" | "medium" | "low";
export type EvidenceType = "stale_pr" | "review_pickup" | "reviewer_concentration" | "ci_friction" | "oversized_pr";

export interface IFlowRule extends Document {
  ruleCode: RuleCode;
  name: string;
  description: string;
  /** Metric key this rule evaluates */
  metricKey: string;
  /** Threshold value that triggers this rule */
  threshold: number;
  /** Unit of the threshold (e.g. "hours", "pct", "count") */
  thresholdUnit: string;
  /** Comparison operator: gte (>=) or lte (<=) */
  operator: "gte" | "lte";
  /** Severity when metric crosses threshold */
  severity: RuleSeverityLevel;
  evidenceType: EvidenceType;
  /** Whether this rule is active */
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const flowRuleSchema = new Schema<IFlowRule>(
  {
    ruleCode: {
      type: String,
      enum: ["R1", "R2", "R3", "R4", "R5"],
      required: true,
      unique: true,
    },
    name: { type: String, required: true },
    description: { type: String, required: true },
    metricKey: { type: String, required: true },
    threshold: { type: Number, required: true },
    thresholdUnit: { type: String, required: true },
    operator: { type: String, enum: ["gte", "lte"], required: true },
    severity: { type: String, enum: ["high", "medium", "low"], required: true },
    evidenceType: {
      type: String,
      enum: ["stale_pr", "review_pickup", "reviewer_concentration", "ci_friction", "oversized_pr"],
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Note: unique index on ruleCode is already created by { unique: true } in the field definition above

export const FlowRule = mongoose.model<IFlowRule>("FlowRule", flowRuleSchema, "flowRules");
