import { useQuery, useMutation } from '@tanstack/react-query';
import { getWebhookEvents, retryWebhookEvent } from '../services/githubService';

export const useWebhookEvents = (id: string, params?: { page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ['repositories', id, 'webhook-events', params],
    queryFn: () => getWebhookEvents(id, params).then((response) => response),
    enabled: Boolean(id),
  });
};

export const useRetryWebhookEvent = () => {
  return useMutation({
    mutationFn: ({ id, eventId }: { id: string; eventId: string }) => retryWebhookEvent(id, eventId),
  });
};
