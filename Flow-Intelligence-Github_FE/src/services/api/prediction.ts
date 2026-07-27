import { apiClient } from '../axiosClient.js';

export type PredictionRiskLabel = 'Low' | 'Medium' | 'High';

export interface PredictionPullRequest {
  _id: string;
  number: number;
  title: string;
  state: string;
  authorLogin?: string;
  prUrl?: string;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  commits?: number;
  createdAt?: string;
}

export interface PredictionModelVersion {
  _id?: string;
  version?: string;
  algorithm?: string;
  trainedAt?: string;
}

export interface PredictionDetail {
  _id?: string;
  pullRequestId: string | PredictionPullRequest;
  modelVersionId: string | PredictionModelVersion;
  modelVersion?: PredictionModelVersion;
  probability: number;
  riskLabel: PredictionRiskLabel;
  featureSummary: Record<string, number | string | boolean>;
  probabilities?: Record<string, number>;
  topFactors?: Array<{
    factor: string;
    direction?: 'increase' | 'decrease';
    strength?: number;
    rawValue?: number;
    baselineValue?: number;
  }>;
  predictedAt: string;
  createdAt?: string;
}

export interface PredictionSummary {
  total: number;
  riskCounts: Record<PredictionRiskLabel, number>;
  highOrMediumCount: number;
  averageConfidence: number;
  highestRiskLabel: PredictionRiskLabel | null;
  latestPredictedAt: string | null;
  topFactors: Array<{ factor: string; count: number }>;
}

export interface PredictionListResponse {
  summary: PredictionSummary;
  predictions: PredictionDetail[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const predictionApi = {
  listPredictions: async (
    repositoryId: string,
    params: { riskLabel?: PredictionRiskLabel; page?: number; limit?: number } = {}
  ): Promise<PredictionListResponse> => {
    const response = await apiClient.get<{
      success: boolean;
      data: PredictionListResponse;
      pagination?: PredictionListResponse['pagination'];
    }>(`/repositories/${repositoryId}/predictions`, { params });
    return {
      ...response.data.data,
      pagination: response.data.pagination,
    };
  },

  getPredictionByPRId: async (repositoryId: string, pullRequestId: string): Promise<PredictionDetail> => {
    const response = await apiClient.get<{ success: boolean; data: PredictionDetail }>(
      `/repositories/${repositoryId}/predictions/${pullRequestId}`
    );
    return response.data.data;
  },
};
