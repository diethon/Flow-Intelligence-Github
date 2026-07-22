import mongoose, { Document, Schema } from "mongoose";
import type { RuleCode } from "./FlowRule.js";

export interface IRecommendation extends Document {
  ruleCode: RuleCode;
  /** Short unique action code, e.g. "assign_backup_reviewer" */
  actionCode: string;
  title: string;
  description: string;
  /** No HR/performance language — must be safe workflow action */
  category: "process" | "tooling" | "communication" | "visibility";
  createdAt: Date;
  updatedAt: Date;
}

const recommendationSchema = new Schema<IRecommendation>(
  {
    ruleCode: {
      type: String,
      enum: ["R1", "R2", "R3", "R4", "R5"],
      required: true,
    },
    actionCode: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ["process", "tooling", "communication", "visibility"],
      required: true,
    },
  },
  { timestamps: true }
);

// Query index per design doc
recommendationSchema.index({ ruleCode: 1, actionCode: 1 });

export const Recommendation = mongoose.model<IRecommendation>(
  "Recommendation",
  recommendationSchema,
  "recommendations"
);
