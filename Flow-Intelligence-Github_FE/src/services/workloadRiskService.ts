import apiClient, { handleApiError } from './axiosClient';
import type { ApiResponse } from '../types';
import type { WorkloadRiskResult } from '../types/workload';

export interface WorkloadRiskRange {
  /** Inclusive start of the window (ISO date/datetime). */
  windowStart: string;
  /** Inclusive end of the window (ISO date/datetime). */
  windowEnd: string;
}

/**
 * Developer Burnout / Workload Risk — analyze off-hours (weekend/night, UTC)
 * commit & review activity for a repository over an explicit date range the
 * user picked before clicking Analyze.
 */
export const analyzeWorkloadRisk = async (
  repositoryId: string,
  range: WorkloadRiskRange
): Promise<ApiResponse<WorkloadRiskResult>> => {
  try {
    const { data } = await apiClient.post<ApiResponse<WorkloadRiskResult>>(
      `/repositories/${repositoryId}/workload-risk/analyze`,
      undefined,
      { params: { windowStart: range.windowStart, windowEnd: range.windowEnd } }
    );
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};
