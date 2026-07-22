import { useQuery } from '@tanstack/react-query';
import { predictionApi } from '../services/api/prediction.js';

export const usePredictionDetail = (repositoryId: string, pullRequestId: string | undefined) => {
  return useQuery({
    queryKey: ['prediction', repositoryId, pullRequestId],
    queryFn: () => predictionApi.getPredictionByPRId(repositoryId, pullRequestId!),
    enabled: Boolean(repositoryId && pullRequestId),
  });
};
