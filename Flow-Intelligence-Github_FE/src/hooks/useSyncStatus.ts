import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSyncStatus as fetchSyncStatus, triggerSync } from '../services/githubService';
import { getSyncRuns } from '../services/repositoryService';

export const useSyncStatus = (id: string, params?: { page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ['repositories', id, 'sync-status', params],
    queryFn: () => fetchSyncStatus(id, params),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.data?.syncStatus?.status;
      return status === 'running' ? 3000 : false;
    },
  });
};

export const useSyncRuns = (id: string, params?: { page?: number; limit?: number; type?: string; status?: string }) => {
  return useQuery({
    queryKey: ['repositories', id, 'sync-runs', params],
    queryFn: async ({ queryKey }) => {
      const [, , , queryParams] = queryKey as [string, string, string, { page?: number; limit?: number; type?: string; status?: string }];
      return getSyncRuns(id, queryParams);
    },
    enabled: Boolean(id),
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: (query) => {
      const runs = query.state.data?.runs || [];
      const hasRunningJob = runs.some((run: any) => run.status === 'running' || run.status === 'pending');
      return hasRunningJob ? 3000 : false;
    },
  });
};

export const useSyncNow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => triggerSync(id, { type: 'incremental' }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      queryClient.invalidateQueries({ queryKey: ['repositories', id] });
      queryClient.invalidateQueries({ queryKey: ['repositories', id, 'sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['repositories', id, 'sync-runs'] });
    },
  });
};
