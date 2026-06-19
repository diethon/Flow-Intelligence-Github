import mongoose, { Document, Schema } from "mongoose";
import type { RuleCode } from "./FlowRule.js";

export type RiskEventStatus = "active" | "resolved" | "suppressed";
export type RiskSeverity = "high" | "medium" | "low";

export interface IRiskEvent extends Document {
  repositoryId: mongoose.Types.ObjectId;
  ruleCode: RuleCode;
  severity: RiskSeverity;
  status: RiskEventStatus;
  /** The computed metric value that triggered this rule */
  metricValue: number;
  /** The rule threshold that was crossed */
  thresholdValue: number;
  windowStart: Date;
  windowEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

const riskEventSchema = new Schema<IRiskEvent>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    ruleCode: { type: String, enum: ["R1", "R2", "R3", "R4", "R5"], required: true },
    severity: { type: String, enum: ["high", "medium", "low"], required: true },
    status: {
      type: String,
      enum: ["active", "resolved", "suppressed"],
      default: "active",
    },
    metricValue: { type: Number, required: true },
    thresholdValue: { type: Number, required: true },
    windowStart: { type: Date, required: true },
    windowEnd: { type: Date, required: true },
  },
  { timestamps: true }
);

// Query indexes per design doc
riskEventSchema.index({ repositoryId: 1, severity: 1, createdAt: -1 });
riskEventSchema.index({ repositoryId: 1, ruleCode: 1, windowStart: 1, windowEnd: 1 });

export const RiskEvent = mongoose.model<IRiskEvent>("RiskEvent", riskEventSchema, "riskEvents");
