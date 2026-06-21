import React from 'react';
import { Link } from 'react-router-dom';
import { useEvidenceCard } from '../hooks/useEvidence';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SeverityTag, SourceTag, EntityIcon } from '../components/EvidenceTags';
import { ConfidenceGauge } from '../components/ConfidenceGauge';
import { SEVERITY, ENTITY_LABEL, relativeTime } from '../components/evidenceMeta';
import type { EvidenceCard, EvidenceItem } from '../types';

interface EvidenceCardDetailPageProps {
  repositoryId: string;
  cardId: string;
}

const parseErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    try {
      return (JSON.parse(error.message) as { message?: string }).message ?? error.message;
    } catch {
      return error.message;
    }
  }
  return 'Could not load this Evidence Card.';
};

/** One numbered exhibit; an outbound link to the GitHub record when available. */
const Exhibit: React.FC<{ item: EvidenceItem; index: number }> = ({ item, index }) => {
  const ordinal = String(index + 1).padStart(2, '0');
  const hasLink = Boolean(item.sourceUrl);

  const body = (
    <>
      <div className="flex shrink-0 flex-col items-center">
        <span className="font-mono text-xs text-slate-400">{ordinal}</span>
        <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <EntityIcon entityType={item.entityType} />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium text-slate-900">{item.sourceLabel}</span>
          <span className="text-xs text-slate-400">{ENTITY_LABEL[item.entityType]}</span>
        </div>
        <p className="mt-1 text-sm text-slate-600">{item.summary}</p>
        {hasLink ? (
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 group-hover:text-indigo-700">
            Open on GitHub
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5v5m0-5L10 14M19 14v5H5V5h5" />
            </svg>
          </span>
        ) : (
          <span className="mt-2 inline-block font-mono text-[11px] uppercase tracking-wide text-slate-400">
            No external link
          </span>
        )}
      </div>
    </>
  );

  const shell =
    'group flex gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-colors';

  return hasLink ? (
    <a
      href={item.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className={`${shell} hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30`}
    >
      {body}
    </a>
  ) : (
    <div className={shell}>{body}</div>
  );
};

const CardBody: React.FC<{ card: EvidenceCard; repositoryId: string }> = ({ card, repositoryId }) => {
  const sev = SEVERITY[card.severity];
  const caseId = card._id.slice(-6).toUpperCase();

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Verdict header with severity rail */}
      <div className="flex">
        <span className={`w-1.5 shrink-0 ${sev.rail}`} aria-hidden />
        <div className="flex-1 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityTag severity={card.severity} />
            <SourceTag sourceType={card.sourceType} />
            <span className="font-mono text-[11px] uppercase tracking-wide text-slate-400">
              Case {caseId}
            </span>
            <span className="font-mono text-[11px] text-slate-400">· {relativeTime(card.createdAt)}</span>
          </div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">{card.title}</h1>
          <p className="mt-2 text-slate-600">{card.summary}</p>
        </div>
      </div>

      <div className="grid gap-6 border-t border-slate-100 p-6 lg:grid-cols-[1fr_18rem]">
        {/* Exhibits ledger */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Exhibits</h2>
            <span className="font-mono text-xs text-slate-400">
              {card.evidence.length} linked {card.evidence.length === 1 ? 'record' : 'records'}
            </span>
          </div>
          <div className="space-y-3">
            {card.evidence.map((item, i) => (
              <Exhibit key={`${item.entityId}-${i}`} item={item} index={i} />
            ))}
          </div>
        </section>

        {/* Case meta */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <ConfidenceGauge confidence={card.confidence} variant="block" />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wide">Suggested action</span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{card.suggestedAction}</p>
          </div>

          {/* Limitation stamp — honesty made visible */}
          <div className="rounded-xl border border-dashed border-slate-300 p-4">
            <span className="font-mono text-[11px] uppercase tracking-wide text-slate-400">
              Limitation
            </span>
            <p className="mt-1.5 text-sm text-slate-600">{card.limitation}</p>
          </div>
        </aside>
      </div>

      <p className="border-t border-slate-100 px-6 py-3 text-xs text-slate-400">
        Workflow signal for the whole team — not a measure of any individual's performance.
        <Link
          to={`/repositories/${repositoryId}/risk-evidence`}
          className="ml-1 font-medium text-slate-500 hover:text-slate-700"
        >
          Back to all risks
        </Link>
      </p>
    </article>
  );
};

export const EvidenceCardDetailPage: React.FC<EvidenceCardDetailPageProps> = ({
  repositoryId,
  cardId,
}) => {
  const query = useEvidenceCard(cardId);
  const card = query.data?.data;

  React.useEffect(() => {
    console.log('[EvidenceCardDetailPage] Displaying detail page for repository:', repositoryId, 'card ID:', cardId);
    console.log('[EvidenceCardDetailPage] Query status:', {
      loading: query.isLoading,
      success: query.isSuccess,
      error: query.isError
    });
    if (query.isSuccess && card) {
      console.log('[EvidenceCardDetailPage] Successfully loaded Evidence Card:', card);
    }
    if (query.isError) {
      console.error('[EvidenceCardDetailPage] Failed to load Evidence Card details:', query.error);
    }
  }, [repositoryId, cardId, query.isLoading, query.isSuccess, query.isError, card]);

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to={`/repositories/${repositoryId}/risk-evidence`}
        className="mb-5 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Risk &amp; Evidence
      </Link>

      {query.isLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12">
          <LoadingSpinner label="Loading Evidence Card..." />
        </div>
      )}

      {query.isError && !query.isLoading && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <p className="font-medium text-rose-800">Could not load this Evidence Card</p>
          <p className="mt-0.5 text-sm text-rose-700">{parseErrorMessage(query.error)}</p>
          <button
            onClick={() => query.refetch()}
            className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {query.isSuccess && card && card.evidence.length > 0 && (
        <CardBody card={card} repositoryId={repositoryId} />
      )}

      {/* A card with no evidence is not shown (guardrail mirror). */}
      {query.isSuccess && card && card.evidence.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="font-medium text-slate-700">This card has no evidence</p>
          <p className="mt-1 text-sm text-slate-500">
            Cards without supporting GitHub records are not displayed.
          </p>
        </div>
      )}
    </div>
  );
};

export default EvidenceCardDetailPage;
