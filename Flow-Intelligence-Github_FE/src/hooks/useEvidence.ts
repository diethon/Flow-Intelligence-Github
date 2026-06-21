import { useQuery } from '@tanstack/react-query';
import { getEvidenceCards, getEvidenceCard } from '../services/evidenceService';
import type { EvidenceListParams } from '../types';

/**
 * UC-16 — list Evidence Cards for a repository. Mirrors the Dashboard pattern:
 * fetch a generous page once, then filter/sort/paginate on the client so the
 * severity counts stay accurate.
 */
export const useEvidenceCards = (repositoryId: string, params: EvidenceListParams = {}) => {
  return useQuery({
    queryKey: ['repositories', repositoryId, 'evidence-cards', params],
    queryFn: () => getEvidenceCards(repositoryId, params),
    enabled: Boolean(repositoryId),
  });
};

export const useEvidenceCard = (cardId: string) => {
  return useQuery({
    queryKey: ['evidence-cards', cardId],
    queryFn: () => getEvidenceCard(cardId),
    enabled: Boolean(cardId),
  });
};
