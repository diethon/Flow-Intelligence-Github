import { useQuery } from '@tanstack/react-query';
import { analyzeWorkloadRisk } from '../services/workloadRiskService';

/**
 * Runs the Workload Risk (burnout) analysis for a repository. The backend
 * POST endpoint computes the signal, builds an Evidence Card and (optionally)
 * calls the AI. We model it as a query so the page gets loading/error/refetch
 * for free; call `refetch()` to re-run the analysis.
 */
export const useWorkloadRisk = (repositoryId: string, windowDays = 7) => {
  return useQuery({
    queryKey: ['repositories', repositoryId, 'workload-risk', windowDays],
    queryFn: () => analyzeWorkloadRisk(repositoryId, windowDays),
    enabled: Boolean(repositoryId),
    // Analysis is relatively expensive (AI call) — don't auto-refetch.
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  });
};
