import apiClient, { handleApiError } from './axiosClient';
import type { ApiResponse, PaginatedResponse, WebhookEvent } from '../types';
import type { GitHubRepository, RepositoryDetails, SyncStatusResponse, SyncStatus } from '../types';

export const connectRepository = async (payload: {
  owner: string;
  repo: string;
}): Promise<ApiResponse<{ repository: GitHubRepository; connectionId: string }>> => {
  try {
    const { data } = await apiClient.post<ApiResponse<{ repository: GitHubRepository; connectionId: string }>>(
      '/github/connect',
      payload
    );
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const getRepositories = async (): Promise<PaginatedResponse<GitHubRepository>> => {
  try {
    const { data } = await apiClient.get<PaginatedResponse<GitHubRepository>>('/github/repositories');
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const getRepositoryById = async (id: string): Promise<ApiResponse<GitHubRepository>> => {
  try {
    const { data } = await apiClient.get<ApiResponse<GitHubRepository>>(`/github/repositories/${id}`);
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const getRepositoryDetails = async (id: string): Promise<ApiResponse<RepositoryDetails>> => {
  try {
    const { data } = await apiClient.get<ApiResponse<RepositoryDetails>>(`/github/repositories/${id}/details`);
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const disconnectRepository = async (id: string): Promise<ApiResponse<{ disconnected: boolean }>> => {
  try {
    const { data } = await apiClient.delete<ApiResponse<{ disconnected: boolean }>>(`/github/disconnect/${id}`);
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const triggerSync = async (
  id: string,
  payload: { type?: 'initial' | 'incremental'; jobTypes?: string[] } = {}
): Promise<ApiResponse<{ syncRunId: string; jobsEnqueued: string[] }>> => {
  try {
    const { data } = await apiClient.post<ApiResponse<{ syncRunId: string; jobsEnqueued: string[] }>>(
      `/repositories/${id}/sync`,
      payload
    );
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const getSyncStatus = async (
  id: string,
  params: { page?: number; limit?: number } = {}
): Promise<SyncStatusResponse> => {
  try {
    const { data } = await apiClient.get<SyncStatusResponse>(`/repositories/${id}/sync-status`, { params });
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const getSyncStatusSummary = async (
  id: string
): Promise<ApiResponse<{ syncStatus: { status: SyncStatus; lastSyncAt: string; pendingJobs: number } }>> => {
  try {
    const { data } = await apiClient.get<ApiResponse<{ syncStatus: { status: SyncStatus; lastSyncAt: string; pendingJobs: number } }>>(
      `/repositories/${id}/sync-status`
    );
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const getWebhookEvents = async (
  id: string,
  params: { page?: number; limit?: number; eventType?: string } = {}
): Promise<PaginatedResponse<WebhookEvent>> => {
  try {
    const { data } = await apiClient.get<PaginatedResponse<WebhookEvent>>(`/repositories/${id}/webhooks`, { params });
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const retryWebhookEvent = async (id: string, eventId: string): Promise<ApiResponse<{ retried: boolean }>> => {
  try {
    const { data } = await apiClient.post<ApiResponse<{ retried: boolean }>>(
      `/repositories/${id}/webhooks/${eventId}/retry`
    );
    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

export const getSuggestedRepositories = async (): Promise<{ repositories: { name: string; full_name: string; description: string | null; private: boolean; html_url: string }[] }> => {
  try {
    const { data } = await apiClient.get<{ success: boolean; data: { repositories: { name: string; full_name: string; description: string | null; private: boolean; html_url: string }[] } }>('/github/repositories/suggested');
    return data.data;
  } catch (error) {
    throw handleApiError(error);
  }
};
