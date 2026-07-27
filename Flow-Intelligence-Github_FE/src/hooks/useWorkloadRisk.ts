import { useMutation } from '@tanstack/react-query';
import { analyzeWorkloadRisk, type WorkloadRiskRange } from '../services/workloadRiskService';

/**
 * Runs the Workload Risk (burnout) analysis for a repository. The analysis is
 * relatively expensive (it may call the AI provider), so it must only run when
 * the user picks a date range and clicks Analyze — never automatically. We model
 * it as a mutation: call `mutate({ windowStart, windowEnd })` to run it, and read
 * the last result from `data`.
 */
export const useWorkloadRisk = (repositoryId: string) => {
  return useMutation({
    mutationFn: (range: WorkloadRiskRange) => analyzeWorkloadRisk(repositoryId, range),
  });
};
