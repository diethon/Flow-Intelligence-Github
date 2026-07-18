import { apiClient } from '../axiosClient.js';

export interface PredictionDetail {
  pullRequestId: string;
  modelVersionId: string;
  probability: number;
  riskLabel: 'Low' | 'Medium' | 'High';
  featureSummary: Record<string, number | string | boolean>;
  predictedAt: string;
}

export const predictionApi = {
  getPredictionByPRId: async (repositoryId: string, pullRequestId: string): Promise<PredictionDetail> => {
    const response = await apiClient.get<{ success: boolean; data: PredictionDetail }>(
      `/repositories/${repositoryId}/predictions/${pullRequestId}`
    );
    return response.data.data;
  },
};
