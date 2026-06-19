import { useState, useEffect, useCallback } from "react";
import type { RiskEvent, EvidenceCard } from "../types/risk.js";
import { evaluateRisk, fetchRiskEvents } from "../api/riskApi.js";
import { fetchDashboardRepositories } from "../api/dashboardApi.js";
import type { Repository } from "../types/dashboard.js";
import {
  PageShell, SectionHeading,
  GhostBtn, PrimaryBtn, ErrorAlert, EmptyState,
  WindowSelector, RepoSelect,
} from "../components/PageShell.js";
import { RiskBadge } from "../components/RiskBadge.js";

// ─── Config ───────────────────────────────────────────────────────────────────

const RULE_ICONS: Record<string, string> = {
  R1: "⏳", R2: "⏱️", R3: "👤", R4: "🔴", R5: "📦",
};

const RULE_NAMES: Record<string, string> = {
  R1: "Stale PRs",
  R2: "Slow Review Pickup",
  R3: "Reviewer Concentration",
  R4: "CI Friction",
  R5: "Oversized PRs",
};

const RULE_ACCENT: Record<string, { bar: string; code: string; border: string; bg: string }> = {
  R1: { bar: "bg-rose-500",   code: "bg-rose-500/20 text-rose-300 border-rose-500/40",       border: "border-rose-500/30",   bg: "bg-rose-500/8"   },
  R2: { bar: "bg-amber-500",  code: "bg-amber-500/20 text-amber-300 border-amber-500/40",     border: "border-amber-500/30",  bg: "bg-amber-500/8"  },
  R3: { bar: "bg-amber-500",  code: "bg-amber-500/20 text-amber-300 border-amber-500/40",     border: "border-amber-500/30",  bg: "bg-amber-500/8"  },
  R4: { bar: "bg-rose-500",   code: "bg-rose-500/20 text-rose-300 border-rose-500/40",       border: "border-rose-500/30",   bg: "bg-rose-500/8"   },
  R5: { bar: "bg-orange-500", code: "bg-orange-500/20 text-orange-300 border-orange-500/40", border: "border-orange-500/30", bg: "bg-orange-500/8" },
};

// ─── Evidence card ────────────────────────────────────────────────────────────

function EvidenceCardItem({ card }: { card: EvidenceCard }) {
  const ENTITY_ICONS: Record<string, string> = {
    pull_request: "🔀", review: "📝", check_run: "🔴", other: "📌",
  };
  const fmtDate = (d: string) => new Date(d).toLocaleDateString();
  const fmtNum  = (n: number | null | undefined, u: string) =>
    n == null ? "—" : `${n % 1 === 0 ? n : n.toFixed(1)} ${u}`;

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0 mt-0.5">{ENTITY_ICONS[card.entityType] ?? "📌"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap mb-2">
            <p className="text-sm font-semibold text-white">{card.title}</p>
            {card.url && (
              <a href={card.url} target="_blank" rel="noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-lg transition-colors">
                View ↗
              </a>
            )}
          </div>
          {/* Metrics */}
          {(card.metric?.value != null || card.metric?.unit) && (
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-base font-bold tabular-nums ${
                (card.metric.value ?? 0) > (card.metric.threshold ?? Infinity) ? "text-rose-400" : "text-emerald-400"
              }`}>
                {fmtNum(card.metric.value ?? null, card.metric.unit)}
              </span>
              {card.metric.threshold != null && (
                <span className="text-xs text-slate-500">
                  / threshold: {fmtNum(card.metric.threshold, card.metric.unit)}
                </span>
              )}
            </div>
          )}
          {/* Context labels */}
          <div className="flex flex-wrap gap-2">
            {card.author && <span className="text-xs bg-slate-700 text-slate-400 px-2.5 py-1 rounded-lg">👤 {card.author}</span>}
            {card.detectedAt && <span className="text-xs bg-slate-700 text-slate-400 px-2.5 py-1 rounded-lg">📅 {fmtDate(card.detectedAt)}</span>}
            {card.labels?.map((l) => (
              <span key={l} className="text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-lg">{l}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Risk event card ──────────────────────────────────────────────────────────

function RiskEventCard({ event, dimmed = false }: { event: RiskEvent; dimmed?: boolean }) {
  const [open, setOpen] = useState(false);
  const acc = RULE_ACCENT[event.ruleCode] ?? RULE_ACCENT.R1;
  const icon = RULE_ICONS[event.ruleCode] ?? "⚠️";
  const triggered = event.status === "active";

  const fmtMetric = (v: number | null | undefined, u: string) =>
    v == null ? "—" : `${v % 1 === 0 ? v : v.toFixed(1)} ${u}`;

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      dimmed ? "border-slate-800 bg-slate-900/30 opacity-60 hover:opacity-80" : `${acc.border} ${acc.bg}`
    }`}>
      <div className="flex">
        <div className={`w-1.5 flex-shrink-0 ${triggered ? acc.bar : "bg-slate-700"}`} />
        <div className="flex-1">
          {/* Main row */}
          <div className="flex items-center gap-4 p-5">
            {/* Icon */}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
              triggered ? "bg-slate-800" : "bg-slate-800/50"
            }`}>
              {icon}
            </div>

            {/* Labels */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-lg border ${acc.code}`}>
                  {event.ruleCode}
                </span>
                <span className="text-base font-bold text-white">
                  {RULE_NAMES[event.ruleCode] ?? event.ruleCode}
                </span>
              </div>
              {/* Metric vs threshold */}
              {event.metricValue != null && (
                <div className="flex items-center gap-2 text-sm">
                  <span className={`font-bold tabular-nums ${triggered ? "text-rose-400" : "text-emerald-400"}`}>
                    {fmtMetric(event.metricValue, event.metricUnit)}
                  </span>
                  <span className="text-slate-600">/</span>
                  <span className="text-slate-500">threshold {fmtMetric(event.threshold, event.metricUnit)}</span>
                </div>
              )}
            </div>

            {/* Status badge */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {triggered
                ? <span className="text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-3 py-1.5 rounded-xl">⚡ Triggered</span>
                : <span className="text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl">✓ OK</span>
              }

              {/* Evidence toggle */}
              {triggered && event.evidenceCards && event.evidenceCards.length > 0 && (
                <button
                  onClick={() => setOpen((v) => !v)}
                  className="text-xs border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-xl transition-colors"
                >
                  {open ? "▲ Hide" : `▼ Evidence (${event.evidenceCards.length})`}
                </button>
              )}
            </div>
          </div>

          {/* Recommendations summary (collapsed, just text) */}
          {triggered && event.suggestedAction && !open && (
            <div className="px-5 pb-4 border-t border-white/5 pt-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                <span className="text-slate-400 font-semibold">Suggested: </span>
                {event.suggestedAction}
              </p>
            </div>
          )}

          {/* Evidence expanded */}
          {open && triggered && (
            <div className="border-t border-white/5 p-5 space-y-3">
              <p className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                🔍 Evidence Cards
                <span className="text-slate-600 font-normal">— items that triggered this rule</span>
              </p>
              {event.evidenceCards?.map((card) => <EvidenceCardItem key={card._id} card={card} />)}
              {event.suggestedAction && (
                <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-4 py-3 mt-3">
                  <p className="text-xs font-semibold text-indigo-400 mb-1">💡 Suggested Action</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{event.suggestedAction}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Overall risk hero ────────────────────────────────────────────────────────

import type { RiskLevel } from "../types/dashboard.js";

const OVERALL_BG: Record<RiskLevel, string> = {
  high:   "from-rose-500/15 to-transparent border-rose-500/30",
  medium: "from-amber-500/15 to-transparent border-amber-500/30",
  low:    "from-yellow-500/15 to-transparent border-yellow-500/30",
  good:   "from-emerald-500/15 to-transparent border-emerald-500/30",
};

const OVERALL_MSG: Record<RiskLevel, string> = {
  high:   "Multiple risk rules triggered. Immediate attention recommended.",
  medium: "Some risk rules triggered. Plan a team review.",
  low:    "Minor risks detected. Monitor and address when possible.",
  good:   "All rules within healthy thresholds. 🎉",
};

function OverallRiskHero({ level, triggered, total, windowDays }: {
  level: RiskLevel; triggered: number; total: number; windowDays: number;
}) {
  return (
    <div className={`rounded-2xl border bg-gradient-to-r p-7 ${OVERALL_BG[level]}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        {/* Badge */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
            Overall Risk · {windowDays}d window
          </p>
          <RiskBadge level={level} size="lg" />
        </div>

        {/* Rule counts */}
        <div className="flex items-center gap-6 sm:border-l sm:border-white/10 sm:pl-6">
          <div className="text-center">
            <p className="text-4xl font-bold text-rose-400 tabular-nums">{triggered}</p>
            <p className="text-xs text-slate-500 mt-1">triggered</p>
          </div>
          <div className="text-slate-700 text-2xl font-thin">/</div>
          <div className="text-center">
            <p className="text-4xl font-bold text-slate-400 tabular-nums">{total}</p>
            <p className="text-xs text-slate-500 mt-1">total rules</p>
          </div>
        </div>

        {/* Message */}
        <div className="sm:border-l sm:border-white/10 sm:pl-6 flex-1">
          <p className="text-base text-slate-300 leading-relaxed">{OVERALL_MSG[level]}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function RiskPage() {
  const [repos, setRepos]               = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [windowDays, setWindowDays]     = useState(7);
  const [events, setEvents]             = useState<RiskEvent[]>([]);
  const [loading, setLoading]           = useState(false);
  const [evaluating, setEvaluating]     = useState(false);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardRepositories()
      .then((data) => { setRepos(data); if (data.length > 0) setSelectedRepoId(data[0]._id); })
      .catch(() => setError("Cannot reach backend."));
  }, []);

  const loadEvents = useCallback(async () => {
    if (!selectedRepoId) return;
    setLoading(true); setError(null);
    try {
      const data = await fetchRiskEvents(selectedRepoId, windowDays);
      setEvents(data);
    } catch { setError("Failed to load risk events."); }
    finally { setLoading(false); }
  }, [selectedRepoId, windowDays]);

  useEffect(() => { if (selectedRepoId) loadEvents(); }, [selectedRepoId, windowDays, loadEvents]);

  const handleEvaluate = async () => {
    if (!selectedRepoId) return;
    setEvaluating(true); setError(null);
    try {
      const result = await evaluateRisk(selectedRepoId, windowDays);
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

  const selectedRepo = repos.find((r) => r._id === selectedRepoId);

  return (
    <PageShell
      title="Risk Evaluation"
      subtitle={selectedRepo ? selectedRepo.fullName : "Evaluate Delivery Flow Risk"}
      actions={
        <>
          <RepoSelect repos={repos} value={selectedRepoId} onChange={setSelectedRepoId} />
          <WindowSelector value={windowDays} onChange={setWindowDays} />
          <PrimaryBtn onClick={handleEvaluate} disabled={!selectedRepoId} loading={evaluating}>
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
          description='Click "Evaluate Rules" to run R1–R5 evaluation against the selected repository and window.'
          action={<PrimaryBtn onClick={handleEvaluate} disabled={!selectedRepoId} loading={evaluating}>⚡ Evaluate Rules</PrimaryBtn>}
        />
      )}

      {/* Loading */}
      {loading && events.length === 0 && (
        <div className="space-y-4">
          <div className="h-36 rounded-2xl bg-slate-900/60 animate-pulse" />
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-slate-900/60 animate-pulse" />)}
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
          />

          {/* Triggered rules */}
          {triggeredEvents.length > 0 && (
            <section>
              <SectionHeading
                title="Triggered Rules"
                subtitle="These rules exceeded their thresholds — immediate attention recommended"
                right={
                  <span className="text-sm font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-3 py-1.5 rounded-lg">
                    {triggeredEvents.length} triggered
                  </span>
                }
              />
              <div className="space-y-4">
                {triggeredEvents.map((e) => <RiskEventCard key={e._id} event={e} />)}
              </div>
            </section>
          )}

          {/* OK rules */}
          {okEvents.length > 0 && (
            <section>
              <SectionHeading
                title="Within Thresholds"
                subtitle="These rules are healthy — no action needed"
                right={
                  <span className="text-sm font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
                    {okEvents.length} OK
                  </span>
                }
              />
              <div className="space-y-3">
                {okEvents.map((e) => <RiskEventCard key={e._id} event={e} dimmed />)}
              </div>
            </section>
          )}

          {/* Footer */}
          {events.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                Evaluates R1–R5 rules against real (or seeded) GitHub data and persists results as
                RiskEvent + EvidenceCard documents. No individual scoring. Results are team-level only.
              </p>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
