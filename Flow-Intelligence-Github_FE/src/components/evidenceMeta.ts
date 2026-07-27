import type {
  EvidenceConfidence,
  EvidenceEntityType,
  EvidenceSeverity,
} from '../types';

/**
 * Visual + textual config for the Risk & Evidence surface. Severity always
 * carries a text label (not colour alone) per the privacy/accessibility rule.
 */
export const SEVERITY: Record<
  EvidenceSeverity,
  { label: string; rail: string; text: string; chip: string; dot: string }
> = {
  high: {
    label: 'High',
    rail: 'bg-rose-500',
    text: 'text-rose-700',
    chip: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    dot: 'bg-rose-500',
  },
  medium: {
    label: 'Medium',
    rail: 'bg-amber-500',
    text: 'text-amber-700',
    chip: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    dot: 'bg-amber-500',
  },
  low: {
    label: 'Low',
    rail: 'bg-sky-500',
    text: 'text-sky-700',
    chip: 'bg-sky-50 text-sky-700 ring-sky-600/20',
    dot: 'bg-sky-500',
  },
};

export const SEVERITY_ORDER: EvidenceSeverity[] = ['high', 'medium', 'low'];
const SEVERITY_RANK: Record<EvidenceSeverity, number> = { high: 3, medium: 2, low: 1 };
export const severityRank = (s: EvidenceSeverity): number => SEVERITY_RANK[s];

export const SOURCE: Record<
  string,
  { label: string; short: string; chip: string }
> = {
  rule_based: {
    label: 'Rule-based',
    short: 'RULE',
    chip: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  },
  ml_prediction: {
    label: 'ML prediction',
    short: 'MODEL',
    chip: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  },
  // fallback for backward compatibility if needed
  risk_event: {
    label: 'Rule-based',
    short: 'RULE',
    chip: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  },
  prediction: {
    label: 'ML prediction',
    short: 'MODEL',
    chip: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  },
};

export const CONFIDENCE_LEVEL: Record<EvidenceConfidence, number> = { low: 1, medium: 2, high: 3 };

export const ENTITY_LABEL: Record<EvidenceEntityType, string> = {
  pull_request: 'Pull request',
  issue: 'Issue',
  commit: 'Commit',
  check_run: 'Check run',
  review: 'Review',
  contributor: 'Contributor',
};

/** Compact relative time, falling back to a date for anything older than a week. */
export const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};
