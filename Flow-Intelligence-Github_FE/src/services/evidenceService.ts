import apiClient, { handleApiError } from './axiosClient';
import type { ApiResponse, EvidenceCard, EvidenceListParams } from '../types';

/**
 * UC-16 / E6-S3 — Risk & Evidence API client.
 * The backend list endpoint returns cards in `data` and paging on `pagination`.
 */
export const getEvidenceCards = async (
  repositoryId: string,
  params: EvidenceListParams = {}
): Promise<ApiResponse<EvidenceCard[]>> => {
  try {
    const { data } = await apiClient.get<ApiResponse<EvidenceCard[]>>(
      `/repositories/${repositoryId}/evidence-cards`,
      { params }
    );
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const getEvidenceCard = async (cardId: string): Promise<ApiResponse<EvidenceCard>> => {
  try {
    const { data } = await apiClient.get<ApiResponse<EvidenceCard>>(`/evidence-cards/${cardId}`);
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};
