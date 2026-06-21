import React from 'react';
import type { EvidenceEntityType, EvidenceSeverity, EvidenceSourceType } from '../types';
import { SEVERITY, SOURCE } from './evidenceMeta';

const chipBase =
  'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset';

/** Severity as text + colour (never colour alone). */
export const SeverityTag: React.FC<{ severity: EvidenceSeverity }> = ({ severity }) => {
  const s = SEVERITY[severity];
  return (
    <span className={`${chipBase} ${s.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label} severity
    </span>
  );
};

/** Provenance of the card: rule engine vs ML model. */
export const SourceTag: React.FC<{ sourceType: EvidenceSourceType }> = ({ sourceType }) => {
  const src = SOURCE[sourceType];
  if (!src) return null;
  return (
    <span className={`${chipBase} ${src.chip}`}>
      <span className="font-mono tracking-wide">{src.short}</span>
    </span>
  );
};

/** Small monochrome glyph per evidence entity type. */
export const EntityIcon: React.FC<{ entityType: EvidenceEntityType; className?: string }> = ({
  entityType,
  className = 'h-4 w-4',
}) => {
  const common = {
    className,
    fill: 'none' as const,
    stroke: 'currentColor' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  };
  switch (entityType) {
    case 'pull_request':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="2.5" strokeLinecap="round" />
          <circle cx="6" cy="18" r="2.5" strokeLinecap="round" />
          <circle cx="18" cy="18" r="2.5" strokeLinecap="round" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 8.5v7M18 15.5V11a3 3 0 00-3-3h-3m0 0l2.5-2.5M12 8l2.5 2.5" />
        </svg>
      );
    case 'issue':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="2.2" />
        </svg>
      );
    case 'commit':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path strokeLinecap="round" d="M12 3v6M12 15v6" />
        </svg>
      );
    case 'check_run':
      return (
        <svg {...common}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.5l2 2 4-4.5" />
          <circle cx="12" cy="12" r="8.5" />
        </svg>
      );
  }
};
