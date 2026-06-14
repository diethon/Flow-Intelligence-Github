import { Schema, model, Document } from 'mongoose';

import type { RuleCode } from './FlowRule.js';

export interface IRecommendation extends Document {
  ruleCode: RuleCode;
  actionCode: string;
  title: string;
  suggestedAction: string;
  rationale: string;
  isActive: boolean;
}

const RecommendationSchema = new Schema<IRecommendation>(
  {
    ruleCode: { type: String, enum: ['R1', 'R2', 'R3', 'R4', 'R5'], required: true },
    actionCode: { type: String, required: true },
    title: { type: String, required: true },
    suggestedAction: { type: String, required: true },
    rationale: { type: String, required: true },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

RecommendationSchema.index({ ruleCode: 1, actionCode: 1 }, { unique: true });

export const Recommendation = model<IRecommendation>('Recommendation', RecommendationSchema);
