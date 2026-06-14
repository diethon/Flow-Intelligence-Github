import { Schema, model, Document, Types } from 'mongoose';

interface EvidenceItem {
  label: string;
  value: string | number;
}

export interface IEvidenceCard extends Document {
  repositoryId: Types.ObjectId;
  riskEventId?: Types.ObjectId;
  predictionId?: Types.ObjectId;
  sourceType: 'rule' | 'ml';
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  summary: string;
  evidence: EvidenceItem[];
  confidence: number | string;
  limitation: string;
  suggestedAction: string;
  createdAt: Date;
  hasEvidence(): boolean;
}

const EvidenceCardSchema = new Schema<IEvidenceCard>(
  {
    repositoryId: { type: Schema.Types.ObjectId, required: true },
    riskEventId: { type: Schema.Types.ObjectId, default: null },
    predictionId: { type: Schema.Types.ObjectId, default: null },
    sourceType: { type: String, enum: ['rule', 'ml'], required: true },
    title: { type: String, required: true },
    severity: { type: String, enum: ['critical', 'high', 'medium', 'low'], required: true },
    summary: { type: String, required: true },
    evidence: {
      type: [
        {
          label: { type: String, required: true },
          value: { type: Schema.Types.Mixed, required: true },
        },
      ],
      required: true,
      validate: {
        validator: (arr: EvidenceItem[]) => arr.length > 0,
        message: 'evidence array must not be empty',
      },
    },
    confidence: { type: Schema.Types.Mixed, required: true },
    limitation: { type: String, required: true },
    suggestedAction: { type: String, required: true },
  },
  { timestamps: true }
);

EvidenceCardSchema.index({ repositoryId: 1, severity: 1, createdAt: -1 });

EvidenceCardSchema.methods.hasEvidence = function (this: IEvidenceCard): boolean {
  return this.evidence.length > 0;
};

export const EvidenceCard = model<IEvidenceCard>('EvidenceCard', EvidenceCardSchema);
