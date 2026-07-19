import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import type { RiskEvent } from "../types/risk.js";
import { evaluateRisk, fetchRiskEvents } from "../api/riskApi.js";
import {
  PageShell, SectionHeading,
  PrimaryBtn, ErrorAlert, EmptyState,
} from "../components/PageShell.js";
import { RiskBadge } from "../components/RiskBadge.js";

// ─── Config ───────────────────────────────────────────────────────────────────

import { RiskEventCard } from "../components/RiskEventCard.js";

// ─── Overall risk hero ────────────────────────────────────────────────────────

import type { RiskLevel } from "../types/dashboard.js";

const OVERALL_BG: Record<RiskLevel, string> = {
  high:   "from-rose-100/60 via-rose-50/20 to-transparent border-rose-200 text-rose-800 shadow-sm",
  medium: "from-amber-100/60 via-amber-50/20 to-transparent border-amber-200 text-amber-800 shadow-sm",
  low:    "from-yellow-100/60 via-yellow-50/20 to-transparent border-yellow-200 text-yellow-800 shadow-sm",
  good:   "from-emerald-100/60 via-emerald-50/20 to-transparent border-emerald-200 text-emerald-800 shadow-sm",
};

const OVERALL_MSG: Record<RiskLevel, string> = {
  high:   "Multiple risk rules triggered. Immediate attention recommended.",
  medium: "Some risk rules triggered. Plan a team review.",
  low:    "Minor risks detected. Monitor and address when possible.",
  good:   "All rules within healthy thresholds. 🎉",
};

function OverallRiskHero({ level, triggered, total, windowDays, startDate, endDate }: {
  level: RiskLevel; triggered: number; total: number; windowDays: number; startDate?: string; endDate?: string;
}) {
  return (
    <div className={`rounded-2xl border bg-gradient-to-r p-7 bg-white ${OVERALL_BG[level]}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        {/* Badge */}
        <div>
          <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/20 mb-2">
            <span className="text-sm">🗓️</span>
            <span className="text-xs font-semibold">
            {windowDays === 0
              ? (startDate && endDate ? `${startDate} to ${endDate}` : "All Time Risk Evaluation")
              : `Overall Risk · ${windowDays}d window`}
            </span>
          </div>
          <RiskBadge level={level} size="lg" />
        </div>

        {/* Rule counts */}
        <div className="flex items-center gap-6 sm:border-l sm:border-slate-200 sm:pl-6">
          <div className="text-center">
            <p className="text-4xl font-extrabold text-rose-600 tabular-nums">{triggered}</p>
            <p className="text-xs text-slate-400 mt-1 font-semibold">triggered</p>
          </div>
          <div className="text-slate-300 text-2xl font-thin">/</div>
          <div className="text-center">
            <p className="text-4xl font-extrabold text-slate-500 tabular-nums">{total}</p>
            <p className="text-xs text-slate-400 mt-1 font-semibold">total rules</p>
          </div>
        </div>

        {/* Message */}
        <div className="sm:border-l sm:border-slate-200 sm:pl-6 flex-1">
          <p className="text-base text-slate-700 leading-relaxed font-medium">{OVERALL_MSG[level]}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface RiskPageProps {
  repositoryId: string;
}

export function RiskPage({ repositoryId }: RiskPageProps) {
  const [windowDays] = useState(() => {
    const cached = localStorage.getItem("selectedWindowDays");
    return cached ? parseInt(cached, 10) : 7;
  });
  const [startDate] = useState(() => {
    const cached = localStorage.getItem("selectedStartDate");
    if (cached) return cached;
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    const val = start.toISOString().split("T")[0];
    localStorage.setItem("selectedStartDate", val);
    return val;
  });
  const [endDate] = useState(() => {
    const cached = localStorage.getItem("selectedEndDate");
    if (cached) return cached;
    const val = new Date().toISOString().split("T")[0];
    localStorage.setItem("selectedEndDate", val);
    return val;
  });
  const [events, setEvents]             = useState<RiskEvent[]>([]);
  const [loading, setLoading]           = useState(false);
  const [evaluating, setEvaluating]     = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!repositoryId) return;
    setLoading(true); setError(null);
    try {
      const data = await fetchRiskEvents(
        repositoryId,
        windowDays,
        startDate || undefined,
        endDate || undefined
      );
      setEvents(data ? data.events : []);
    } catch { setError("Failed to load risk events."); }
    finally { setLoading(false); }
  }, [repositoryId, windowDays, startDate, endDate]);

  useEffect(() => { if (repositoryId) loadEvents(); }, [repositoryId, loadEvents]);

  const handleEvaluate = async () => {
    if (!repositoryId) return;
    setEvaluating(true); setError(null);
    try {
      const result = await evaluateRisk(
        repositoryId,
        windowDays,
        startDate || undefined,
        endDate || undefined
      );
      setEvents(result.events);
    } catch { setError("Evaluation failed. Make sure backend is running."); }
    finally { setEvaluating(false); }
  };

  const triggeredEvents = events.filter((e) => e.status === "active");
  const okEvents        = events.filter((e) => e.status !== "active");
  const overallLevel: RiskLevel =
    triggeredEvents.length === 0 ? "good"
    : triggeredEvents.length >= 3 ? "high"
    : "medium";

  return (
    <PageShell
      title="Risk"

      actions={
        <>
          <Link
            to={`/repositories/${repositoryId}/evidence`}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-200 bg-indigo-50/50 px-3 py-2 rounded-lg transition-colors"
          >
            View evidence →
          </Link>
          <PrimaryBtn onClick={handleEvaluate} disabled={!repositoryId} loading={evaluating}>
            ⚡ Evaluate Rules
          </PrimaryBtn>
        </>
      }
    >
      {error && <ErrorAlert message={error} />}

      {/* Empty state */}
      {!loading && events.length === 0 && !error && (
        <EmptyState
          icon="🔍"
          title="No risk data yet"
          description='Click "Evaluate Rules" to run R1–R5 evaluation against this repository and window.'
          action={<PrimaryBtn onClick={handleEvaluate} disabled={!repositoryId} loading={evaluating}>⚡ Evaluate Rules</PrimaryBtn>}
        />
      )}

      {/* Loading */}
      {loading && events.length === 0 && (
        <div className="space-y-4">
          <div className="h-36 rounded-2xl bg-white animate-pulse border border-slate-200" />
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white animate-pulse border border-slate-200" />)}
        </div>
      )}

      {/* Content */}
      {events.length > 0 && (
        <>
          {/* Hero */}
          <OverallRiskHero
            level={overallLevel}
            triggered={triggeredEvents.length}
            total={events.length}
            windowDays={windowDays}
            startDate={startDate}
            endDate={endDate}
          />

          {/* Triggered rules */}
          {triggeredEvents.length > 0 && (
            <section className="space-y-4">
              <SectionHeading
                title="Triggered Rules"
                subtitle="These rules exceeded their thresholds — immediate attention recommended"
                right={
                  <span className="text-sm font-bold bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg shadow-sm">
                    {triggeredEvents.length} triggered
                  </span>
                }
              />
              <div className="space-y-4">
                {triggeredEvents.map((e) => <RiskEventCard key={e.id} event={e} repositoryId={repositoryId} />)}
              </div>
            </section>
          )}

          {/* OK rules */}
          {okEvents.length > 0 && (
            <section className="space-y-4">
              <SectionHeading
                title="Within Thresholds"
                subtitle="These rules are healthy — no action needed"
                right={
                  <span className="text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-250 px-3 py-1.5 rounded-lg shadow-sm">
                    {okEvents.length} OK
                  </span>
                }
              />
              <div className="space-y-3">
                {okEvents.map((e) => <RiskEventCard key={e.id} event={e} repositoryId={repositoryId} dimmed />)}
              </div>
            </section>
          )}

          {/* Footer */}
          {events.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-100/30 px-5 py-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Evaluates R1–R5 rules against real GitHub data and persists results as
                RiskEvent + EvidenceCard documents. No individual scoring. Results are team-level only.
              </p>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}

export default RiskPage;
