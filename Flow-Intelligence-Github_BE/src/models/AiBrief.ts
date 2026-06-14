import { Schema, model, Document, Types } from 'mongoose';

interface BriefItem {
  evidenceCardId: Types.ObjectId;
  section: string;
  text: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface IAiBrief extends Document {
  repositoryId: Types.ObjectId;
  windowStart: Date;
  windowEnd: Date;
  status: 'generating' | 'ready' | 'failed';
  summary: string;
  confidence: 'high' | 'medium' | 'low';
  limitations: string[];
  items: BriefItem[];
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const AiBriefSchema = new Schema<IAiBrief>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    windowStart: { type: Date, required: true },
    windowEnd: { type: Date, required: true },
    status: { type: String, enum: ['generating', 'ready', 'failed'], required: true, default: 'generating' },
    summary: { type: String, default: '' },
    confidence: { type: String, enum: ['high', 'medium', 'low'], required: true, default: 'medium' },
    limitations: [{ type: String }],
    items: [
      {
        evidenceCardId: { type: Schema.Types.ObjectId, ref: 'EvidenceCard', required: true },
        section: { type: String, required: true },
        text: { type: String, required: true },
        severity: { type: String, enum: ['critical', 'high', 'medium', 'low'], required: true },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

AiBriefSchema.index({ repositoryId: 1, createdAt: -1 });

export const AiBrief = model<IAiBrief>('AiBrief', AiBriefSchema);
