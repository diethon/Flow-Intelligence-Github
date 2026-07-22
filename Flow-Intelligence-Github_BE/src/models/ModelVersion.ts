import mongoose, { Document, Schema } from "mongoose";

export type ModelStatus = "available" | "retired" | "failed";

export interface IModelVersion extends Document {
  version: string;
  algorithm: string;
  artifactPath: string;
  featureSchemaPath: string;
  evaluationMetrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    auc?: number;
    [key: string]: number | undefined;
  };
  status: ModelStatus;
  trainedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const modelVersionSchema = new Schema<IModelVersion>(
  {
    version: { type: String, required: true, unique: true },
    algorithm: { type: String, required: true },
    artifactPath: { type: String, required: true },
    featureSchemaPath: { type: String, required: true },
    evaluationMetrics: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["available", "retired", "failed"],
      default: "available",
    },
    trainedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Unique index per design doc
modelVersionSchema.index({ version: 1 }, { unique: true });
// Query index per design doc
modelVersionSchema.index({ status: 1, trainedAt: -1 });

export const ModelVersion = mongoose.model<IModelVersion>("ModelVersion", modelVersionSchema, "modelVersions");
