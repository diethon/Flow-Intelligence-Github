import { Schema, model, Document } from 'mongoose';

// R1: Stale PR, R2: Oversized PR, R3: Reviewer Concentration, R4: CI Friction, R5: Review Lag
export type RuleCode = 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

export interface IFlowRule extends Document {
  ruleCode: RuleCode;
  name: string;
  description: string;
  metricKey: string;
  thresholdValue: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  isActive: boolean;
}

const FlowRuleSchema = new Schema<IFlowRule>(
  {
    ruleCode: { type: String, enum: ['R1', 'R2', 'R3', 'R4', 'R5'], required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    metricKey: { type: String, required: true },
    thresholdValue: { type: Number, required: true },
    severity: { type: String, enum: ['critical', 'high', 'medium', 'low'], required: true },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

FlowRuleSchema.index({ ruleCode: 1 }, { unique: true });

export const FlowRule = model<IFlowRule>('FlowRule', FlowRuleSchema);
