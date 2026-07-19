import apiClient, { handleApiError } from './axiosClient';
import type { ApiResponse } from '../types';
import type { WorkloadRiskResult } from '../types/workload';

/**
 * Developer Burnout / Workload Risk — analyze off-hours (weekend/night, UTC)
 * commit & review activity for a repository and window.
 */
export const analyzeWorkloadRisk = async (
  repositoryId: string,
  windowDays = 7
): Promise<ApiResponse<WorkloadRiskResult>> => {
  try {
    const { data } = await apiClient.post<ApiResponse<WorkloadRiskResult>>(
      `/repositories/${repositoryId}/workload-risk/analyze`,
      undefined,
      { params: { windowDays } }
    );
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};
