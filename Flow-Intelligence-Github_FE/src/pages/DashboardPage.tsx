import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { Repository, DashboardSummary, RiskLevel, DataQualityLevel } from "../types/dashboard.js";
import { fetchDashboardRepositories, fetchDashboard, seedAndFetchRepo } from "../api/dashboardApi.js";
import { RiskBadge } from "../components/RiskBadge.js";
import { DashboardKPICard } from "../components/DashboardKPICard.js";
import { BottleneckCard }   from "../components/BottleneckCard.js";
import {
  PageShell, Tabs, SectionHeading,
  GhostBtn, PrimaryBtn, ErrorAlert, EmptyState,
  WindowSelector, RepoSelect,
} from "../components/PageShell.js";

type Tab = "kpis" | "bottlenecks";

// ─── Overall risk hero ────────────────────────────────────────────────────────

const RISK_BG: Record<RiskLevel, string> = {
  high:   "from-rose-500/15 via-rose-500/5   to-transparent border-rose-500/30",
  medium: "from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/30",
  low:    "from-yellow-500/15 via-yellow-500/5 to-transparent border-yellow-500/30",
  good:   "from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/30",
};

const RISK_MSG: Record<RiskLevel, string> = {
  high:   "Multiple rules triggered. Bottlenecks detected that may impact delivery.",
  medium: "Some rules triggered. Review and plan a response soon.",
  low:    "Minor issues detected. Monitor and address when convenient.",
  good:   "No risk rules triggered. Delivery flow looks healthy! 🎉",
};

function HeroRisk({ level, triggeredCount, windowDays }: { level: RiskLevel; triggeredCount: number; windowDays: number }) {
  return (
    <div className={`rounded-2xl border bg-gradient-to-r p-7 ${RISK_BG[level]}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        {/* Badge + count */}
        <div className="flex items-center gap-5">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
              Delivery Flow Risk · {windowDays}d window
            </p>
            <RiskBadge level={level} size="lg" />
          </div>
          {triggeredCount > 0 && (
            <div className="text-center border-l border-white/10 pl-5">
              <p className="text-4xl font-bold text-rose-400 tabular-nums">{triggeredCount}</p>
              <p className="text-xs text-slate-500 mt-1">rule{triggeredCount !== 1 ? "s" : ""} triggered</p>
            </div>
          )}
        </div>
        {/* Message */}
        <div className="sm:border-l sm:border-white/10 sm:pl-5 flex-1">
          <p className="text-base text-slate-300 leading-relaxed">{RISK_MSG[level]}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Data quality strip ───────────────────────────────────────────────────────

const DQ_CFG: Record<DataQualityLevel, { pill: string; icon: string; label: string }> = {
  good:    { pill: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", icon: "✓", label: "Data quality: Good"    },
  partial: { pill: "bg-amber-500/20   text-amber-300   border-amber-500/40",   icon: "!", label: "Data quality: Partial" },
  poor:    { pill: "bg-rose-500/20    text-rose-300    border-rose-500/40",    icon: "✕", label: "Data quality: Poor"    },
};

function DataQualityStrip({ level, warnings, lastSynced }: {
  level: DataQualityLevel;
  warnings: { code: string; severity: string; message: string }[];
  lastSynced: string | null;
}) {
  const [open, setOpen] = useState(false);
  const cfg = DQ_CFG[level];
  const syncLabel = lastSynced
    ? `Last sync: ${new Date(lastSynced).toLocaleString()}`
    : "Never synced";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${cfg.pill}`}>
            {cfg.icon} {cfg.label}
          </span>
          <span className="text-sm text-slate-500">{syncLabel}</span>
        </div>
        {warnings.length > 0 && (
          <button onClick={() => setOpen((v) => !v)} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            {warnings.length} warning{warnings.length > 1 ? "s" : ""} {open ? "▲" : "▼"}
          </button>
        )}
      </div>
      {open && warnings.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-white/5 pt-3">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-400">
              <span className={w.severity === "error" ? "text-rose-400" : "text-amber-400"}>{w.severity === "error" ? "✕" : "!"}</span>
              {w.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── KPI Skeletons ────────────────────────────────────────────────────────────

function KPISkeletons() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-44 rounded-2xl bg-slate-900/60 animate-pulse" />
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate();
  const [repos, setRepos]               = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [windowDays, setWindowDays]     = useState(7);
  const [dashboard, setDashboard]       = useState<DashboardSummary | null>(null);
  const [loading, setLoading]           = useState(false);
  const [seeding, setSeeding]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [tab, setTab]                   = useState<Tab>("kpis");

  useEffect(() => {
    fetchDashboardRepositories()
      .then((data) => { setRepos(data); if (data.length > 0) setSelectedRepoId(data[0]._id); })
      .catch(() => setError("Could not reach backend. Make sure the server is running."));
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!selectedRepoId) return;
    setLoading(true); setError(null);
    try {
      const data = await fetchDashboard(selectedRepoId, windowDays);
      setDashboard(data);
    } catch {
      setError("Failed to load dashboard. Make sure backend is running and data is seeded.");
      setDashboard(null);
    } finally { setLoading(false); }
  }, [selectedRepoId, windowDays]);

  useEffect(() => { if (selectedRepoId) loadDashboard(); }, [selectedRepoId, windowDays, loadDashboard]);

  const handleSeed = async () => {
    setSeeding(true); setError(null);
    try {
      const repoId = await seedAndFetchRepo();
      const updated = await fetchDashboardRepositories();
      setRepos(updated); setSelectedRepoId(repoId);
    } catch { setError("Seed failed. Make sure MongoDB is running."); }
    finally { setSeeding(false); }
  };

  const selectedRepo = repos.find((r) => r._id === selectedRepoId);
  const triggered    = dashboard?.bottlenecks.filter((b) => b.isTriggered) ?? [];

  return (
    <PageShell
      title="Team Flow Dashboard"
      subtitle={selectedRepo ? selectedRepo.fullName : undefined}
      actions={
        <>
          <RepoSelect repos={repos} value={selectedRepoId} onChange={setSelectedRepoId} />
          <WindowSelector value={windowDays} onChange={setWindowDays} />
          <PrimaryBtn onClick={loadDashboard} disabled={!selectedRepoId} loading={loading}>↻ Refresh</PrimaryBtn>
        </>
      }
    >
      {error && <ErrorAlert message={error} />}

      {!loading && !dashboard && !error && repos.length === 0 && (
        <EmptyState
          icon="📊"
          title="No repositories yet"
          description="Seed demo data to see the Team Flow Dashboard."
          action={<PrimaryBtn onClick={handleSeed} loading={seeding}>🌱 Seed Demo Data</PrimaryBtn>}
        />
      )}

      {(loading || dashboard) && (
        <>
          {/* Data quality */}
          {dashboard && (
            <DataQualityStrip
              level={dashboard.dataQuality.level}
              warnings={dashboard.dataQuality.warnings}
              lastSynced={dashboard.dataQuality.lastSyncedAt}
            />
          )}
          {loading && !dashboard && <div className="h-14 rounded-xl bg-slate-900/60 animate-pulse" />}

          {/* Hero risk */}
          {dashboard
            ? <HeroRisk level={dashboard.overallRiskLevel} triggeredCount={dashboard.triggeredRuleCount} windowDays={windowDays} />
            : <div className="h-32 rounded-2xl bg-slate-900/60 animate-pulse" />
          }

          {/* Tabs */}
          <Tabs<Tab>
            tabs={[
              { id: "kpis",         label: "Performance KPIs", icon: "📈" },
              { id: "bottlenecks",  label: "Bottleneck Analysis", icon: "⚠️", badge: triggered.length },
            ]}
            active={tab}
            onChange={setTab}
          />

          {/* Tab: KPIs */}
          {tab === "kpis" && (
            <section>
              <SectionHeading title="Key Performance Indicators" subtitle={`Metrics for the last ${windowDays} days`} />
              {loading && !dashboard ? <KPISkeletons /> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {dashboard?.kpis.map((card) => <DashboardKPICard key={card.key} card={card} />)}
                </div>
              )}
            </section>
          )}

          {/* Tab: Bottlenecks */}
          {tab === "bottlenecks" && (
            <section>
              <SectionHeading
                title="Bottleneck Analysis"
                subtitle={`R1–R5 flow risk rules · ${triggered.length} of ${dashboard?.bottlenecks.length ?? 5} triggered`}
                right={
                  <button onClick={() => navigate("/rulebook")} className="text-sm text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors">
                    View Rulebook →
                  </button>
                }
              />
              {loading && !dashboard ? (
                <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-slate-900/60 animate-pulse" />)}</div>
              ) : (
                <div className="space-y-3">
                  {dashboard?.bottlenecks.map((b) => (
                    <BottleneckCard key={b.ruleCode} card={b} onDrillDown={() => navigate(`/risk`)} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Footer */}
          {dashboard && (
            <div className="flex flex-wrap gap-x-5 gap-y-1 pb-4 text-xs text-slate-600">
              <span>Window: {new Date(dashboard.windowStart).toLocaleDateString()} → {new Date(dashboard.windowEnd).toLocaleDateString()}</span>
              <span>·</span>
              <span>Computed: {new Date(dashboard.computedAt).toLocaleTimeString()}</span>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
