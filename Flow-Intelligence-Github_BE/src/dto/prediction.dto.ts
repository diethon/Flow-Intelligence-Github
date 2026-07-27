import { ModelStatus } from "../models/ModelVersion";
import { RiskLabel } from "../models/PrDelayPrediction";

export interface PredictionRequest {
  repositoryId: string;
  pullRequestId: string;
}

export interface PredictionResult {
  predictionId?: string;
  pullRequestId: string;
  modelVersionId: string;
  probability: number;
  riskLabel: RiskLabel;
  featureSummary: Record<string, number | string | boolean>;
  probabilities?: Record<string, number>;
  topFactors?: any[];
  predictedAt: Date | string;
}

export { ModelStatus, RiskLabel };
