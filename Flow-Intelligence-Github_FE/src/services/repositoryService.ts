import apiClient, { handleApiError } from './axiosClient';
import type { ApiResponse, PaginatedResponse, RepositoryConnection, SyncRun, WebhookEvent } from '../types';

export const getConnections = async (): Promise<ApiResponse<{ connections: RepositoryConnection[] }>> => {
  try {
    const { data } = await apiClient.get<ApiResponse<{ connections: RepositoryConnection[] }>>('/github/status');
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const setupWebhook = async (id: string, webhookUrl: string): Promise<ApiResponse<{ webhookId: number }>> => {
  try {
    const { data } = await apiClient.post<ApiResponse<{ webhookId: number }>>(`/repositories/${id}/webhooks/setup`, {
      webhookUrl,
    });
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const getPullRequests = async (
  repositoryId: string,
  params: { page?: number; limit?: number; state?: string } = {}
): Promise<ApiResponse<{ pullRequests: any[] }>> => {
  try {
    const { data } = await apiClient.get<ApiResponse<{ pullRequests: any[] }>>(`/repositories/${repositoryId}/pull-requests`, { params });
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const getSyncRuns = async (
  id: string,
  params: { page?: number; limit?: number; type?: string; status?: string } = {}
): Promise<PaginatedResponse<SyncRun>> => {
  try {
    const { data } = await apiClient.get<PaginatedResponse<SyncRun>>(`/repositories/${id}/sync-runs`, { params });
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const getSyncRunDetail = async (id: string, runId: string): Promise<ApiResponse<SyncRun>> => {
  try {
    const { data } = await apiClient.get<ApiResponse<SyncRun>>(`/repositories/${id}/sync-runs/${runId}`);
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const getWebhookEventDetail = async (id: string, eventId: string): Promise<ApiResponse<WebhookEvent>> => {
  try {
    const { data } = await apiClient.get<ApiResponse<WebhookEvent>>(`/repositories/${id}/webhooks/${eventId}`);
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const validateRepositoryToken = async (owner: string, repo: string): Promise<ApiResponse<{ valid: boolean }>> => {
  try {
    const { data } = await apiClient.post<ApiResponse<{ valid: boolean }>>(`/github/validate-repository/${owner}/${repo}`);
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};
