import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEvidenceCards } from '../hooks/useEvidence';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EvidenceCardRow } from '../components/EvidenceCardRow';
import { SEVERITY, SEVERITY_ORDER, SOURCE, severityRank } from '../components/evidenceMeta';
import type { EvidenceCard, EvidenceSeverity, EvidenceSourceType } from '../types';

interface EvidencePageProps {
  repositoryId: string;
}

type SeverityFilter = EvidenceSeverity | 'all';
type SourceFilter = EvidenceSourceType | 'all';

const PAGE_SIZE = 8;

const parseErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    try {
      return (JSON.parse(error.message) as { message?: string }).message ?? error.message;
    } catch {
      return error.message;
    }
  }
  return 'Could not load Evidence Cards.';
};

export const EvidencePage: React.FC<EvidencePageProps> = ({ repositoryId }) => {
  // Fetch a generous page, then filter/sort/paginate on the client (matches the
  // Dashboard pattern and keeps the severity counts accurate).
  const query = useEvidenceCards(repositoryId, { limit: 100 });
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const [source, setSource] = useState<SourceFilter>('all');
  const [page, setPage] = useState(1);

  // A card with no evidence is never shown — backend guarantees it, we enforce it too.
  const cards = useMemo<EvidenceCard[]>(
    () => (query.data?.data ?? []).filter((c) => c.evidence.length > 0),
    [query.data?.data]
  );

  const severityCounts = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 } as Record<EvidenceSeverity, number>;
    for (const c of cards) counts[c.severity] += 1;
    return counts;
  }, [cards]);

  const visible = useMemo(() => {
    return cards
      .filter((c) => (severity === 'all' ? true : c.severity === severity))
      .filter((c) => (source === 'all' ? true : c.sourceType === source))
      .sort((a, b) => {
        const bySeverity = severityRank(b.severity) - severityRank(a.severity);
        if (bySeverity !== 0) return bySeverity;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [cards, severity, source]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const changeSeverity = (next: SeverityFilter) => {
    setSeverity(next);
    setPage(1);
  };
  const changeSource = (next: SourceFilter) => {
    setSource(next);
    setPage(1);
  };

  const severityTabs: { key: SeverityFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: cards.length },
    ...SEVERITY_ORDER.map((s) => ({ key: s, label: SEVERITY[s].label, count: severityCounts[s] })),
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to={`/repositories/${repositoryId}/risk`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Risk rules
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Evidence</h1>
        <p className="mt-1 text-slate-500">
          Every card is backed by linked GitHub records — open one to see the evidence behind it.
        </p>
      </div>

      {/* Severity filter strip with counts */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {severityTabs.map((tab) => {
          const active = severity === tab.key;
          const dot = tab.key === 'all' ? null : SEVERITY[tab.key as EvidenceSeverity].dot;
          return (
            <button
              key={tab.key}
              onClick={() => changeSeverity(tab.key)}
              aria-pressed={active}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {dot && <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />}
              {tab.label}
              <span
                className={`font-mono text-xs ${active ? 'text-white/70' : 'text-slate-400'}`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}

        <div className="ml-auto">
          <select
            value={source}
            onChange={(e) => changeSource(e.target.value as SourceFilter)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20 outline-none"
            aria-label="Filter by source"
          >
            <option value="all">All sources</option>
            <option value="risk_event">{SOURCE.risk_event.label}</option>
            <option value="prediction">{SOURCE.prediction.label}</option>
          </select>
        </div>
      </div>

      {/* Loading */}
      {query.isLoading && (
        <div className="rounded-xl border border-slate-200 bg-white p-12">
          <LoadingSpinner label="Loading Evidence Cards..." />
        </div>
      )}

      {/* Error */}
      {query.isError && !query.isLoading && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 shrink-0 text-rose-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div>
              <p className="font-medium text-rose-800">Could not load Evidence Cards</p>
              <p className="mt-0.5 text-sm text-rose-700">{parseErrorMessage(query.error)}</p>
              <button
                onClick={() => query.refetch()}
                className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loaded */}
      {query.isSuccess && !query.isLoading && (
        <>
          {paged.length > 0 ? (
            <div className="space-y-3">
              {paged.map((card) => (
                <EvidenceCardRow
                  key={card._id}
                  card={card}
                  to={`/repositories/${repositoryId}/evidence/${card._id}`}
                />
              ))}
            </div>
          ) : cards.length === 0 ? (
            // True empty — nothing has been generated yet.
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <svg className="h-7 w-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.6 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="font-medium text-slate-700">No evidence yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Evidence Cards appear here once a workflow risk is found or a delay is predicted.
              </p>
            </div>
          ) : (
            // Filtered to nothing.
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <p className="font-medium text-slate-700">No cards match these filters</p>
              <button
                onClick={() => {
                  changeSeverity('all');
                  changeSource('all');
                }}
                className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="font-mono text-xs text-slate-500">
                {safePage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EvidencePage;
