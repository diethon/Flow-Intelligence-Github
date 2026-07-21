import { useState } from "react";
import { useWorkloadRisk } from "../hooks/useWorkloadRisk.js";
import {
  PageShell, SectionHeading, PrimaryBtn, ErrorAlert, EmptyState,
} from "../components/PageShell.js";
import { RiskBadge } from "../components/RiskBadge.js";
import type {
  WorkloadRiskResult, WorkloadAiItem, WorkloadContributorBreakdown,
} from "../types/workload.js";
import type { EvidenceCard, EvidenceItem } from "../types";

const WINDOW_PRESETS = [7, 14, 30, 90];

// ─── Hero ───────────────────────────────────────────────────────────────────

function WorkloadHero({ result, windowDays }: { result: WorkloadRiskResult; windowDays: number }) {
  const a = result.aggregate;
  return (
    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-100/60 via-violet-50/20 to-transparent bg-white p-7">
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 px-3 py-1 bg-white/60 rounded-full border border-slate-200 mb-2 w-fit">
            <span className="text-sm">🌙</span>
            <span className="text-xs font-semibold text-slate-600">Workload Risk · {windowDays}d window (UTC)</span>
          </div>
          <RiskBadge level={result.severity} size="lg" />
        </div>

        <div className="flex items-center gap-6 sm:border-l sm:border-slate-200 sm:pl-6">
          <div className="text-center">
            <p className="text-4xl font-extrabold text-indigo-600 tabular-nums">{a.offHoursPct ?? 0}%</p>
            <p className="text-xs text-slate-400 mt-1 font-semibold">off-hours activity</p>
          </div>
        </div>

        <div className="sm:border-l sm:border-slate-200 sm:pl-6 flex-1">
          <p className="text-base text-slate-700 leading-relaxed font-medium">
            {a.offHoursEvents} of {a.totalEvents} commit/review events happened outside business hours
            (weekends or nights, UTC), across {a.distinctContributorsOffHours} contributors.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Stat card ──────────────────────────────────────────────────────────────

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className={`text-2xl font-extrabold tabular-nums ${accent ?? "text-slate-800"}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5 font-semibold">{label}</p>
    </div>
  );
}

// ─── AI analysis ────────────────────────────────────────────────────────────

function AiItemList({
  items, emptyText, accent,
}: { items: WorkloadAiItem[]; emptyText: string; accent: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 italic">{emptyText}</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className={`border-l-4 ${accent} pl-3`}>
          <h4 className="font-semibold text-slate-800">{item.title}</h4>
          <p className="text-sm text-slate-600 leading-relaxed">{item.detail}</p>
        </li>
      ))}
    </ul>
  );
}

// Mirrors the AI Weekly Brief layout: an executive summary, a two-column
// Key Insights / Recommendations split, and a limitations footer.
function AiAnalysis({ ai }: { ai: NonNullable<WorkloadRiskResult["aiAnalysis"]> }) {
  const risks = ai.items.filter((i) => i.type === "risk_summary");
  const recommendations = ai.items.filter((i) => i.type === "recommendation");

  return (
    <section className="space-y-4">
      <SectionHeading
        title="AI Analysis"
        subtitle="Generated from redacted, team-level counts only — no raw code or comments were sent"
        right={
          ai.isFallback ? (
            <span className="text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg">
              Deterministic fallback
            </span>
          ) : (
            <span className="text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 px-3 py-1.5 rounded-lg">
              Confidence: {ai.confidence}
            </span>
          )
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 mb-3">Executive Summary</h2>
        <p className="text-slate-700 leading-relaxed">{ai.summary}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Key Insights</h3>
          <AiItemList items={risks} emptyText="No significant risks identified." accent="border-amber-400" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Recommendations</h3>
          <AiItemList items={recommendations} emptyText="No specific recommendations at this time." accent="border-emerald-400" />
        </div>
      </div>

      {ai.limitations.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">Limitations &amp; Context</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-slate-500">
            {ai.limitations.map((l, i) => (
              <li key={i} className="leading-relaxed">{l}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ─── Evidence card ──────────────────────────────────────────────────────────

function EvidenceItemRow({ item }: { item: EvidenceItem }) {
  const inner = (
    <>
      <span className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 flex-shrink-0">
        {item.sourceLabel}
      </span>
      <span className="text-sm text-slate-600 truncate">{item.summary}</span>
    </>
  );
  return item.sourceUrl ? (
    <a href={item.sourceUrl} target="_blank" rel="noreferrer"
       className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
      {inner}
      <span className="ml-auto text-xs text-indigo-500 flex-shrink-0">↗</span>
    </a>
  ) : (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
      {inner}
    </div>
  );
}

function EvidenceCardBlock({ card }: { card: EvidenceCard }) {
  return (
    <section className="space-y-4">
      <SectionHeading
        title="Evidence Card"
        subtitle="Every signal is backed by real GitHub records — shown here only, not in the shared Evidence list"
      />
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">{card.title}</h3>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">{card.summary}</p>
          </div>
          <RiskBadge level={card.severity} size="sm" />
        </div>

        <div className="space-y-2">
          {card.evidence.map((item, i) => <EvidenceItemRow key={i} item={item} />)}
        </div>

        <div className="grid sm:grid-cols-2 gap-3 border-t border-slate-100 pt-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Suggested action</p>
            <p className="text-sm text-slate-700 leading-relaxed">{card.suggestedAction}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              Limitation · confidence: {card.confidence}
            </p>
            <p className="text-sm text-slate-500 leading-relaxed">{card.limitation}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Per-contributor breakdown (drill-down) ───────────────────────────────────

function BreakdownDrilldown({ breakdown }: { breakdown: WorkloadContributorBreakdown[] }) {
  if (breakdown.length === 0) return null;
  return (
    <details open className="rounded-2xl border border-slate-200 bg-white group">
      <summary className="cursor-pointer list-none px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-800">Per-contributor breakdown</p>
          <p className="text-xs text-slate-400 mt-0.5">Total vs off-hours commits per contributor</p>
        </div>
        <span className="text-slate-400 text-sm group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="px-6 pb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">
              <th className="py-2">Contributor</th>
              <th className="py-2 text-right">Commits</th>
              <th className="py-2 text-right">Off-hours</th>
              <th className="py-2 text-right">Weekend</th>
              <th className="py-2 text-right">Night</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((b) => (
              <tr key={b.label} className="border-b border-slate-50 last:border-0">
                <td className="py-2.5 font-medium text-slate-700">{b.label}</td>
                <td className="py-2.5 text-right tabular-nums text-slate-500">{b.totalCommits}</td>
                <td className="py-2.5 text-right tabular-nums text-slate-800 font-semibold">{b.offHoursEvents}</td>
                <td className="py-2.5 text-right tabular-nums text-slate-500">{b.weekend}</td>
                <td className="py-2.5 text-right tabular-nums text-slate-500">{b.night}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface WorkloadRiskPageProps {
  repositoryId: string;
}

export function WorkloadRiskPage({ repositoryId }: WorkloadRiskPageProps) {
  const [windowDays, setWindowDays] = useState(() => {
    const cached = localStorage.getItem("selectedWorkloadWindowDays");
    return cached ? parseInt(cached, 10) : 7;
  });

  const { data, isLoading, isFetching, error, refetch } = useWorkloadRisk(repositoryId, windowDays);
  const result = data?.data;

  const changeWindow = (days: number) => {
    setWindowDays(days);
    localStorage.setItem("selectedWorkloadWindowDays", String(days));
  };

  return (
    <PageShell
      title="Workload Risk"
      subtitle="Developer burnout signal from off-hours commit & review activity"
      actions={
        <>
          <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1">
            {WINDOW_PRESETS.map((d) => (
              <button
                key={d}
                onClick={() => changeWindow(d)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  windowDays === d ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <PrimaryBtn onClick={() => refetch()} disabled={!repositoryId} loading={isFetching}>
            ⚡ Analyze
          </PrimaryBtn>
        </>
      }
    >
      {error && <ErrorAlert message="Failed to analyze workload risk. Make sure the backend is running and the repository has synced data." />}

      {/* Loading */}
      {isLoading && !result && (
        <div className="space-y-4">
          <div className="h-36 rounded-2xl bg-white animate-pulse border border-slate-200" />
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-white animate-pulse border border-slate-200" />)}
          </div>
          <div className="h-48 rounded-2xl bg-white animate-pulse border border-slate-200" />
        </div>
      )}

      {/* Insufficient data (privacy guard) */}
      {result && result.aggregate.dataStatus === "insufficient_data" && !error && (
        <EmptyState
          icon="🕊️"
          title="Not enough activity to report"
          description="No actionable workload risk for this window. Signals are only surfaced when at least 3 contributors have off-hours activity, so results can never point at an individual."
        />
      )}

      {/* Content */}
      {result && result.aggregate.dataStatus === "ok" && (
        <>
          <WorkloadHero result={result} windowDays={windowDays} />

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Stat label="total events" value={result.aggregate.totalEvents} />
            <Stat label="off-hours" value={result.aggregate.offHoursEvents} accent="text-indigo-600" />
            <Stat label="on weekends" value={result.aggregate.weekendCount} />
            <Stat label="at night" value={result.aggregate.nightCount} />
            <Stat label="contributors" value={result.aggregate.distinctContributorsOffHours} />
          </div>

          {result.aiAnalysis && <AiAnalysis ai={result.aiAnalysis} />}
          {result.card && <EvidenceCardBlock card={result.card} />}
          <BreakdownDrilldown breakdown={result.breakdown} />

          <div className="rounded-xl border border-slate-200 bg-slate-100/30 px-5 py-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              Off-hours are computed from commit &amp; review timestamps in UTC (no timezone normalization).
              The per-contributor breakdown shows real GitHub identities; use it to support the team, not to
              rank or evaluate individuals. Names are never sent to the AI provider.
            </p>
          </div>
        </>
      )}
    </PageShell>
  );
}

export default WorkloadRiskPage;
