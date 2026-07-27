import { useQuery } from '@tanstack/react-query';
import { predictionApi, type PredictionRiskLabel } from '../services/api/prediction.js';

export const useRepositoryPredictions = (
  repositoryId: string,
  params: { riskLabel?: PredictionRiskLabel; page?: number; limit?: number } = {}
) => {
  return useQuery({
    queryKey: ['repositories', repositoryId, 'predictions', params],
    queryFn: () => predictionApi.listPredictions(repositoryId, params),
    enabled: Boolean(repositoryId),
  });
};

export const usePredictionDetail = (repositoryId: string, pullRequestId: string | undefined) => {
  return useQuery({
    queryKey: ['prediction', repositoryId, pullRequestId],
    queryFn: () => predictionApi.getPredictionByPRId(repositoryId, pullRequestId!),
    enabled: Boolean(repositoryId && pullRequestId),
  });
};
