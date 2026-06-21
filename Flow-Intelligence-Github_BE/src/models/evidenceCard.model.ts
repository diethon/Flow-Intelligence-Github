import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEvidenceItem {
  entityType: string;
  entityId: Types.ObjectId;
  sourceLabel: string;
  sourceUrl: string;
  summary: string;
}

export interface IEvidenceCard extends Document {
  repositoryId: Types.ObjectId;
  riskEventId?: Types.ObjectId;
  predictionId?: Types.ObjectId;
  sourceType: 'risk_event' | 'prediction';
  title: string;
  severity: 'low' | 'medium' | 'high';
  summary: string;
  evidence: IEvidenceItem[];
  suggestedAction: string;
  confidence: 'low' | 'medium' | 'high';
  limitation: string;
  createdAt: Date;
  updatedAt: Date;
}

const EvidenceItemSchema = new Schema<IEvidenceItem>(
  {
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    sourceLabel: { type: String, required: true },
    sourceUrl: { type: String },
    summary: { type: String, required: true },
  },
  { _id: false }
);

const EvidenceCardSchema = new Schema<IEvidenceCard>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'GitHubRepository', required: true, index: true },
    riskEventId: { type: Schema.Types.ObjectId, index: true },
    predictionId: { type: Schema.Types.ObjectId, index: true },
    sourceType: { type: String, enum: ['risk_event', 'prediction'], required: true },
    title: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], required: true },
    summary: { type: String, required: true },
    evidence: { type: [EvidenceItemSchema], required: true },
    suggestedAction: { type: String, required: true },
    confidence: { type: String, enum: ['low', 'medium', 'high'], required: true },
    limitation: { type: String, required: true },
  },
  { timestamps: true }
);

EvidenceCardSchema.index({ repositoryId: 1, severity: 1, createdAt: -1 });

export const EvidenceCard =
  mongoose.models.EvidenceCard || mongoose.model<IEvidenceCard>('EvidenceCard', EvidenceCardSchema);
