import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRepositories, getRepositoryById, getRepositoryDetails, connectRepository, disconnectRepository, triggerSync } from '../services/githubService';
import type { SyncRepositoryPayload } from '../types';

export const useRepositories = () => {
  return useQuery({
    queryKey: ['repositories'],
    queryFn: getRepositories,
  });
};

export const useRepository = (id: string) => {
  return useQuery({
    queryKey: ['repositories', id],
    queryFn: () => getRepositoryById(id),
    enabled: Boolean(id),
  });
};

export const useRepositoryDetails = (id: string) => {
  return useQuery({
    queryKey: ['repositories', id, 'details'],
    queryFn: () => getRepositoryDetails(id),
    enabled: Boolean(id),
  });
};

export const useConnectRepository = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ owner, repo }: { owner: string; repo: string }) => connectRepository({ owner, repo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });
};

export const useDisconnectRepository = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => disconnectRepository(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });
};

export const useSyncRepository = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: SyncRepositoryPayload }) =>
      triggerSync(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });
};

export const useRepositorySyncStatus = (id: string) => {
  return useQuery({
    queryKey: ['repositories', id, 'sync-status'],
    queryFn: () => triggerSync(id).then((response) => response.data),
    enabled: Boolean(id),
    refetchInterval: 5000,
  });
};
