import { Schema, model, Document, Types } from 'mongoose';

import type { RuleCode } from './FlowRule.js';

export interface IRiskEvent extends Document {
  repositoryId: Types.ObjectId;
  ruleCode: RuleCode;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'resolved' | 'dismissed';
  metricValue: number;
  thresholdValue: number;
  windowStart: Date;
  windowEnd: Date;
  affectedRecordIds: Types.ObjectId[];
  createdAt: Date;
}

const RiskEventSchema = new Schema<IRiskEvent>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    ruleCode: { type: String, enum: ['R1', 'R2', 'R3', 'R4', 'R5'], required: true },
    severity: { type: String, enum: ['critical', 'high', 'medium', 'low'], required: true },
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], required: true, default: 'open' },
    metricValue: { type: Number, required: true },
    thresholdValue: { type: Number, required: true },
    windowStart: { type: Date, required: true },
    windowEnd: { type: Date, required: true },
    affectedRecordIds: [{ type: Schema.Types.ObjectId }],
  },
  { timestamps: true }
);

RiskEventSchema.index({ repositoryId: 1, severity: 1, createdAt: -1 });
RiskEventSchema.index({ repositoryId: 1, ruleCode: 1, windowStart: 1, windowEnd: 1 });

export const RiskEvent = model<IRiskEvent>('RiskEvent', RiskEventSchema);
