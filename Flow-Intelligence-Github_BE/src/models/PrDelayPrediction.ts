import { Schema, model, Document, Types } from 'mongoose';

export interface IPrDelayPrediction extends Document {
  repositoryId: Types.ObjectId;
  pullRequestId: Types.ObjectId;
  modelVersionId: Types.ObjectId;
  probability: number;       // 0.0 - 1.0
  riskLabel: 'Low' | 'Medium' | 'High';
  featureSummary: Record<string, unknown>;
  predictedAt: Date;
}

const PrDelayPredictionSchema = new Schema<IPrDelayPrediction>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    pullRequestId: { type: Schema.Types.ObjectId, ref: 'PullRequest', required: true },
    modelVersionId: { type: Schema.Types.ObjectId, ref: 'ModelVersion', required: true },
    probability: { type: Number, required: true, min: 0, max: 1 },
    riskLabel: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
    featureSummary: { type: Schema.Types.Mixed, required: true, default: {} },
    predictedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

PrDelayPredictionSchema.index({ pullRequestId: 1, modelVersionId: 1 }, { unique: true });
PrDelayPredictionSchema.index({ repositoryId: 1, riskLabel: 1, predictedAt: -1 });
PrDelayPredictionSchema.index({ pullRequestId: 1, predictedAt: -1 });

export const PrDelayPrediction = model<IPrDelayPrediction>('PrDelayPrediction', PrDelayPredictionSchema);
