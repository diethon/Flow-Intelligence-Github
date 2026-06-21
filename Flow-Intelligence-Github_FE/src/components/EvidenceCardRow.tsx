import React from 'react';
import { Link } from 'react-router-dom';
import type { EvidenceCard } from '../types';
import { SEVERITY, relativeTime } from './evidenceMeta';
import { SeverityTag, SourceTag } from './EvidenceTags';
import { ConfidenceGauge } from './ConfidenceGauge';

interface EvidenceCardRowProps {
  card: EvidenceCard;
  to: string;
}

/**
 * One Evidence Card as a case-file row: a severity rail on the left edge, the
 * verdict and summary in the middle, the exhibit count + confidence below.
 */
export const EvidenceCardRow: React.FC<EvidenceCardRowProps> = ({ card, to }) => {
  const sev = SEVERITY[card.severity];
  const exhibitCount = card.evidence.length;

  return (
    <Link
      to={to}
      className="group relative flex items-stretch gap-4 rounded-xl border border-slate-200 bg-white pl-0 pr-4 py-4 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30"
    >
      {/* Severity rail */}
      <span className={`w-1 shrink-0 rounded-l-xl ${sev.rail}`} aria-hidden />

      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityTag severity={card.severity} />
          <SourceTag sourceType={card.sourceType} />
          <span className="font-mono text-[11px] text-slate-400">
            {relativeTime(card.createdAt)}
          </span>
        </div>

        <h3 className="mt-2 font-semibold text-slate-900">{card.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-slate-600">{card.summary}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-slate-500">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-slate-100 px-1 text-slate-700">
              {exhibitCount}
            </span>
            {exhibitCount === 1 ? 'exhibit' : 'exhibits'}
          </span>
          <ConfidenceGauge confidence={card.confidence} />
        </div>
      </div>

      <svg
        className="my-auto h-5 w-5 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
};
