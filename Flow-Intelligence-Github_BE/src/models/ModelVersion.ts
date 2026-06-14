import { Schema, model, Document } from 'mongoose';

export interface IModelVersion extends Document {
  version: string;
  algorithm: string;
  artifactPath: string;
  featureSchemaPath: string;
  evaluationMetrics: Record<string, number>;
  status: 'training' | 'ready' | 'deprecated';
  trainedAt: Date;
  createdAt: Date;
}

const ModelVersionSchema = new Schema<IModelVersion>(
  {
    version: { type: String, required: true },
    algorithm: { type: String, required: true },
    artifactPath: { type: String, required: true },
    featureSchemaPath: { type: String, required: true },
    evaluationMetrics: { type: Schema.Types.Mixed, required: true, default: {} },
    status: { type: String, enum: ['training', 'ready', 'deprecated'], required: true, default: 'training' },
    trainedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

ModelVersionSchema.index({ version: 1 }, { unique: true });
ModelVersionSchema.index({ status: 1, trainedAt: -1 });

export const ModelVersion = model<IModelVersion>('ModelVersion', ModelVersionSchema);
