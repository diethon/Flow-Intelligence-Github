import mongoose, { Document, Schema } from "mongoose";

export type RiskLabel = "Low" | "Medium" | "High";

export interface IPrDelayPrediction extends Document {
  repositoryId: mongoose.Types.ObjectId;
  pullRequestId: mongoose.Types.ObjectId;
  modelVersionId: mongoose.Types.ObjectId;
  /** Probability of delay (0.0 – 1.0) */
  probability: number;
  riskLabel: RiskLabel;
  /** Key features used for this prediction — for explainability */
  featureSummary: Record<string, number | string | boolean>;
  predictedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const prDelayPredictionSchema = new Schema<IPrDelayPrediction>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    pullRequestId: { type: Schema.Types.ObjectId, ref: "PullRequest", required: true },
    modelVersionId: { type: Schema.Types.ObjectId, ref: "ModelVersion", required: true },
    probability: { type: Number, required: true, min: 0, max: 1 },
    riskLabel: { type: String, enum: ["Low", "Medium", "High"], required: true },
    featureSummary: { type: Schema.Types.Mixed, default: {} },
    predictedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Unique index per design doc — one prediction per PR per model version
prDelayPredictionSchema.index({ pullRequestId: 1, modelVersionId: 1 }, { unique: true });
// Query indexes per design doc
prDelayPredictionSchema.index({ repositoryId: 1, riskLabel: 1, predictedAt: -1 });
prDelayPredictionSchema.index({ pullRequestId: 1, predictedAt: -1 });

export const PrDelayPrediction = mongoose.model<IPrDelayPrediction>(
  "PrDelayPrediction",
  prDelayPredictionSchema,
  "prDelayPredictions"
);
