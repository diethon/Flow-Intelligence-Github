import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useWorkloadRisk } from "../hooks/useWorkloadRisk.js";
import { useAuth } from "../hooks/useAuth.js";
import { fetchDashboardRepositories } from "../api/dashboardApi.js";
import {
  PageShell, SectionHeading, PrimaryBtn, ErrorAlert, EmptyState, RepoSelect,
} from "../components/PageShell.js";
import { RiskBadge } from "../components/RiskBadge.js";
import type {
  WorkloadRiskResult, WorkloadAiItem, WorkloadContributorBreakdown, WorkloadContributorInsight,
} from "../types/workload.js";

// ─── Date range helpers ───────────────────────────────────────────────────────

const RANGE_PRESETS = [7, 14, 30, 90];

/** Local YYYY-MM-DD for an <input type="date"> value. */
function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return toDateInput(d);
}

function rangeDays(startDate: string, endDate: string): number {
  const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)) + 1);
}

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
            {a.offHoursEvents} of {a.totalEvents} events ({a.commitCount} commits · {a.reviewCount} reviews) happened
            outside business hours (weekends or nights, UTC), across {a.distinctContributorsOffHours} contributors.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Stat card ──────────────────────────────────────────────────────────────

// Shows a headline count with an optional "N off-hours" sub-line so it's clear
// at a glance how much of each kind happened outside business hours.
function Stat({
  label, value, sub, icon, accent,
}: { label: string; value: number; sub?: string; icon?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className={`text-2xl font-extrabold tabular-nums ${accent ?? "text-slate-800"}`}>
        {icon && <span className="mr-1 text-base">{icon}</span>}{value}
      </p>
      <p className="text-xs text-slate-400 mt-0.5 font-semibold">{label}</p>
      {sub && <p className="text-[11px] text-indigo-500 font-semibold mt-0.5">{sub}</p>}
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
    </section>
  );
}

// ─── Per-member insights ──────────────────────────────────────────────────────

// Detailed, supportive commentary on each contributor's activity & load. Names
// are real (page shows identities) but were never sent to the AI — the notes are
// generated against pseudonyms and re-labelled on the server.
// AI's per-member off-hours load level — a burnout-risk signal, not a performance
// score. Kept deliberately supportive in wording.
const LEVEL_BADGE: Record<WorkloadContributorInsight["level"], { label: string; className: string }> = {
  high: { label: "Heavy off-hours load", className: "text-rose-600 bg-rose-50 border-rose-100" },
  medium: { label: "Moderate off-hours load", className: "text-amber-600 bg-amber-50 border-amber-100" },
  low: { label: "Balanced load", className: "text-emerald-600 bg-emerald-50 border-emerald-100" },
};

function ContributorInsights({ insights }: { insights: WorkloadContributorInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <section className="space-y-4">
      <SectionHeading
        title="Per-member insights"
        subtitle="Workflow-oriented notes on each contributor's activity & load — meant to support the team, not to rank or evaluate individuals"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map((c) => {
          const pct = c.totalEvents > 0 ? Math.round((c.offHoursEvents / c.totalEvents) * 100) : 0;
          const badge = LEVEL_BADGE[c.level];
          return (
            <div key={c.contributor} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h4 className="font-bold text-slate-900 truncate">{c.contributor}</h4>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-xs font-bold border px-2 py-1 rounded-lg ${badge.className}`}>
                    {badge.label}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">{pct}% off-hours</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-semibold mb-3">
                <span>
                  📝 {c.commits} commits
                  {c.offHoursCommits > 0 && (
                    <span className="text-amber-600"> · {c.offHoursCommits} off-hrs</span>
                  )}
                </span>
                <span>
                  👀 {c.reviews} reviews
                  {c.offHoursReviews > 0 && (
                    <span className="text-amber-600"> · {c.offHoursReviews} off-hrs</span>
                  )}
                </span>
                <span>🌙 {c.night} night</span>
                <span>📅 {c.weekend} weekend</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{c.note}</p>
              {c.suggestion && (
                <p className="mt-2 text-sm text-emerald-700 leading-relaxed border-l-2 border-emerald-300 pl-3">
                  💡 {c.suggestion}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Per-contributor breakdown (drill-down) ───────────────────────────────────

/** A count cell that also shows how many of those were off-hours. */
function CountCell({ total, offHours }: { total: number; offHours: number }) {
  return (
    <td className="py-2.5 text-right tabular-nums">
      <span className="text-slate-700 font-medium">{total}</span>
      {offHours > 0 && (
        <span className="block text-[11px] text-amber-600 font-semibold">{offHours} off-hrs</span>
      )}
    </td>
  );
}

function BreakdownDrilldown({ breakdown }: { breakdown: WorkloadContributorBreakdown[] }) {
  if (breakdown.length === 0) return null;
  return (
    <details open className="rounded-2xl border border-slate-200 bg-white group">
      <summary className="cursor-pointer list-none px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-800">Per-contributor breakdown</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Commits &amp; reviews per contributor, and how many landed at night or on weekends (UTC)
          </p>
        </div>
        <span className="text-slate-400 text-sm group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="px-6 pb-5 overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">
              <th className="py-2">Contributor</th>
              <th className="py-2 text-right">📝 Commits</th>
              <th className="py-2 text-right">👀 Reviews</th>
              <th className="py-2 text-right">🌙 Night</th>
              <th className="py-2 text-right">📅 Weekend</th>
              <th className="py-2 text-right">Off-hours</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((b) => (
              <tr key={b.label} className="border-b border-slate-50 last:border-0 align-top">
                <td className="py-2.5 font-medium text-slate-700">{b.label}</td>
                <CountCell total={b.commits} offHours={b.offHoursCommits} />
                <CountCell total={b.reviews} offHours={b.offHoursReviews} />
                <td className="py-2.5 text-right tabular-nums text-slate-600">{b.night}</td>
                <td className="py-2.5 text-right tabular-nums text-slate-600">{b.weekend}</td>
                <td className="py-2.5 text-right tabular-nums">
                  <span className="text-slate-900 font-bold">{b.offHoursEvents}</span>
                  <span className="text-slate-400"> / {b.totalEvents}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
          <span className="font-semibold text-amber-600">off-hrs</span> = commits/reviews made outside business hours ·
          <span className="font-semibold"> 🌙 Night</span> = 20:00–06:00 UTC ·
          <span className="font-semibold"> 📅 Weekend</span> = Saturday/Sunday (UTC).
        </p>
      </div>
    </details>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface WorkloadRiskPageProps {
  repositoryId: string;
}

export function WorkloadRiskPage({ repositoryId }: WorkloadRiskPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Repo switcher — jump between connected repos from the header.
  const reposQuery = useQuery({ queryKey: ["dashboard", "repositories"], queryFn: fetchDashboardRepositories });
  const allRepos = reposQuery.data ?? [];

  const isGlobalAdmin = user?.role === "admin";
  const repos = isGlobalAdmin
    ? allRepos
    : allRepos.filter((r) => r.role === "leader");

  const currentRepo = allRepos.find((r) => r._id === repositoryId);
  const isLeaderOrAdmin = isGlobalAdmin || currentRepo?.role === "leader";

  const handleRepoChange = (id: string) => {
    if (!id || id === repositoryId) return;
    localStorage.setItem("selectedRepositoryId", id);
    navigate(`/repositories/${id}/workload-risk`);
  };

  // The user picks a date range and clicks Analyze — nothing runs automatically.
  const [startDate, setStartDate] = useState<string>(() => localStorage.getItem("workloadStartDate") || daysAgo(7));
  const [endDate, setEndDate] = useState<string>(() => localStorage.getItem("workloadEndDate") || daysAgo(0));

  const mutation = useWorkloadRisk(repositoryId);
  const result = mutation.data?.data;
  // Days covered by whatever range produced the current result.
  const analyzedDays = result
    ? rangeDays(result.aggregate.windowStart.slice(0, 10), result.aggregate.windowEnd.slice(0, 10))
    : rangeDays(startDate, endDate);

  const applyPreset = (days: number) => {
    const start = daysAgo(days);
    const end = daysAgo(0);
    setStartDate(start);
    setEndDate(end);
    localStorage.setItem("workloadStartDate", start);
    localStorage.setItem("workloadEndDate", end);
  };

  const runAnalysis = () => {
    if (!repositoryId || !startDate || !endDate) return;
    localStorage.setItem("workloadStartDate", startDate);
    localStorage.setItem("workloadEndDate", endDate);
    mutation.mutate({
      windowStart: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
      windowEnd: new Date(`${endDate}T23:59:59.999Z`).toISOString(),
    });
  };

  const invalidRange = Boolean(startDate && endDate && startDate > endDate);

  if (reposQuery.isSuccess && !isLeaderOrAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <PageShell
      title="Workload Risk"
      subtitle="Developer burnout signal from off-hours commit & review activity"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {repos.length > 0 && (
            <RepoSelect repos={repos} value={repositoryId} onChange={handleRepoChange} />
          )}
          <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5">
            <label className="text-[11px] font-semibold text-slate-500">From</label>
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-medium text-slate-700"
            />
            <label className="text-[11px] font-semibold text-slate-500 ml-1">To</label>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-medium text-slate-700"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1">
            {RANGE_PRESETS.map((d) => (
              <button
                key={d}
                onClick={() => applyPreset(d)}
                className="px-2.5 py-1 rounded-md text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-white transition-colors"
              >
                {d}d
              </button>
            ))}
          </div>
          <PrimaryBtn onClick={runAnalysis} disabled={!repositoryId || invalidRange} loading={mutation.isPending}>
            ⚡ Analyze
          </PrimaryBtn>
        </div>
      }
    >
      {invalidRange && (
        <ErrorAlert message="The start date must be on or before the end date." />
      )}
      {mutation.isError && !invalidRange && (
        <ErrorAlert message="Failed to analyze workload risk. Make sure the backend is running and the repository has synced data." />
      )}

      {/* Initial state — nothing has been analyzed yet */}
      {!result && !mutation.isPending && !mutation.isError && (
        <EmptyState
          icon="🗓️"
          title="Pick a date range, then click Analyze"
          description="Choose a From / To date (or a quick preset) and press ⚡ Analyze to scan off-hours commit & review activity for that window. Nothing runs until you click."
        />
      )}

      {/* Loading */}
      {mutation.isPending && (
        <div className="space-y-4">
          <div className="h-36 rounded-2xl bg-white animate-pulse border border-slate-200" />
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-white animate-pulse border border-slate-200" />)}
          </div>
          <div className="h-48 rounded-2xl bg-white animate-pulse border border-slate-200" />
        </div>
      )}

      {/* Insufficient data (privacy guard) */}
      {result && result.aggregate.dataStatus === "insufficient_data" && !mutation.isPending && (
        <EmptyState
          icon="🕊️"
          title="Not enough activity to report"
          description="No actionable workload risk for this window. Signals are only surfaced when at least 3 contributors have off-hours activity, so results can never point at an individual."
        />
      )}

      {/* Content */}
      {result && result.aggregate.dataStatus === "ok" && !mutation.isPending && (
        <>
          <WorkloadHero result={result} windowDays={analyzedDays} />

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <Stat
              label="commits"
              value={result.aggregate.commitCount}
              sub={`${result.aggregate.offHoursCommitCount} off-hours`}
              icon="📝"
            />
            <Stat
              label="reviews"
              value={result.aggregate.reviewCount}
              sub={`${result.aggregate.offHoursReviewCount} off-hours`}
              icon="👀"
            />
            <Stat label="off-hours" value={result.aggregate.offHoursEvents} accent="text-indigo-600" />
            <Stat label="at night" value={result.aggregate.nightCount} icon="🌙" />
            <Stat label="on weekends" value={result.aggregate.weekendCount} icon="📅" />
            <Stat label="contributors" value={result.aggregate.distinctContributorsOffHours} />
          </div>

          <BreakdownDrilldown breakdown={result.breakdown} />
          {result.aiAnalysis && <AiAnalysis ai={result.aiAnalysis} />}
          {result.aiAnalysis && <ContributorInsights insights={result.aiAnalysis.contributorInsights} />}

          <div className="rounded-xl border border-slate-200 bg-slate-100/30 px-5 py-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              Off-hours are computed from commit &amp; review timestamps in UTC (no timezone normalization).
              Bot commits (e.g. actions-user, *[bot]) are credited to the real person in their
              Co-authored-by trailer when present, otherwise excluded — so the signal reflects people.
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
