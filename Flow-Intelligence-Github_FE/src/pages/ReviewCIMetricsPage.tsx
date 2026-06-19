import { useState, useEffect, useCallback } from "react";
import type { Repository, UC10MetricsResult } from "../types/metrics.js";
import { fetchRepositories, fetchReviewCIMetrics, calculateAndPersistMetrics, seedDemoData } from "../api/metricsApi.js";
import { MetricCard }      from "../components/MetricCard.js";
import { ReviewLoadChart } from "../components/ReviewLoadChart.js";
import { CheckRunsChart }  from "../components/CheckRunsChart.js";
import { PRPickupTable }   from "../components/PRPickupTable.js";
import {
  PageShell, Tabs, SectionHeading,
  GhostBtn, PrimaryBtn, ErrorAlert, EmptyState,
  WindowSelector, RepoSelect,
} from "../components/PageShell.js";

type Tab = "metrics" | "charts" | "prdetails";

function getTrend(value: number | null, thresholds: { good: number; warn: number }, lowerIsBetter = true) {
  if (value === null) return "neutral" as const;
  if (lowerIsBetter) {
    if (value <= thresholds.good) return "good" as const;
    if (value <= thresholds.warn) return "warn" as const;
    return "bad" as const;
  }
  if (value >= thresholds.good) return "good" as const;
  if (value >= thresholds.warn) return "warn" as const;
  return "bad" as const;
}

// ─── Risk Signals ─────────────────────────────────────────────────────────────

function RiskSignals({ metrics }: { metrics: UC10MetricsResult }) {
  const signals = [
    {
      rule: "R2", icon: "⏱️",
      label: "Review Pickup Risk",
      triggered: (metrics.reviewPickup.avgHours ?? 0) > 12,
      detail: metrics.reviewPickup.avgHours !== null
        ? `Avg pickup: ${metrics.reviewPickup.avgHours.toFixed(1)}h (threshold: 12h)`
        : "Insufficient data",
      severity: (metrics.reviewPickup.avgHours ?? 0) > 24 ? "high" : "medium" as "high" | "medium",
    },
    {
      rule: "R3", icon: "👤",
      label: "Reviewer Concentration",
      triggered: (metrics.reviewLoadConcentration.topReviewerPct ?? 0) > 50,
      detail: metrics.reviewLoadConcentration.topReviewerPct !== null
        ? `Top reviewer: ${metrics.reviewLoadConcentration.topReviewerPct.toFixed(1)}% (threshold: 50%)`
        : "Insufficient data",
      severity: (metrics.reviewLoadConcentration.topReviewerPct ?? 0) > 70 ? "high" : "medium" as "high" | "medium",
    },
    {
      rule: "R4", icon: "🔴",
      label: "CI Friction Risk",
      triggered: (metrics.failedCheckRate.failedRatePct ?? 0) > 25,
      detail: metrics.failedCheckRate.failedRatePct !== null
        ? `Failed checks: ${metrics.failedCheckRate.failedRatePct.toFixed(1)}% (threshold: 25%)`
        : "Insufficient data",
      severity: (metrics.failedCheckRate.failedRatePct ?? 0) > 40 ? "high" : "medium" as "high" | "medium",
    },
  ];

  const triggered = signals.filter((s) => s.triggered);

  return (
    <section>
      <SectionHeading
        title="Flow Risk Signals"
        right={
          triggered.length > 0
            ? <span className="text-sm font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-3 py-1.5 rounded-lg">{triggered.length} triggered</span>
            : <span className="text-sm font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg">All clear ✓</span>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {signals.map((s) => (
          <div key={s.rule} className={`rounded-2xl border p-6 ${
            s.triggered
              ? s.severity === "high" ? "bg-rose-500/8 border-rose-500/30" : "bg-amber-500/8 border-amber-500/30"
              : "bg-slate-900/60 border-slate-800"
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{s.icon}</span>
                <div>
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${s.triggered ? "bg-rose-500/20 text-rose-300" : "bg-slate-800 text-slate-500"}`}>
                    {s.rule}
                  </span>
                </div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                s.triggered
                  ? s.severity === "high" ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
              }`}>
                {s.triggered ? s.severity.toUpperCase() : "OK"}
              </span>
            </div>
            <p className="text-base font-semibold text-white mb-2">{s.label}</p>
            <p className="text-sm text-slate-400 leading-relaxed">{s.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ReviewCIMetricsPage() {
  const [repos, setRepos]               = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [windowDays, setWindowDays]     = useState(7);
  const [metrics, setMetrics]           = useState<UC10MetricsResult | null>(null);
  const [loading, setLoading]           = useState(false);
  const [seeding, setSeeding]           = useState(false);
  const [calculating, setCalculating]   = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null);
  const [tab, setTab]                   = useState<Tab>("metrics");

  useEffect(() => {
    fetchRepositories()
      .then((data) => { setRepos(data); if (data.length > 0) setSelectedRepoId(data[0]._id); })
      .catch(() => setRepos([]));
  }, []);

  const loadMetrics = useCallback(async () => {
    if (!selectedRepoId) return;
    setLoading(true); setError(null);
    try {
      const data = await fetchReviewCIMetrics(selectedRepoId, windowDays);
      setMetrics(data); setLastUpdated(new Date());
    } catch {
      setError("Failed to load metrics. Make sure the backend is running.");
      setMetrics(null);
    } finally { setLoading(false); }
  }, [selectedRepoId, windowDays]);

  useEffect(() => { if (selectedRepoId) loadMetrics(); }, [selectedRepoId, windowDays, loadMetrics]);

  const handleSeed = async () => {
    setSeeding(true); setError(null);
    try {
      const result = await seedDemoData();
      const updatedRepos = await fetchRepositories();
      setRepos(updatedRepos);
      const seededRepo = updatedRepos.find((r) => r._id === result.repositoryId);
      if (seededRepo) setSelectedRepoId(seededRepo._id);
    } catch { setError("Failed to seed demo data. Make sure MongoDB is running."); }
    finally { setSeeding(false); }
  };

  const handleCalculate = async () => {
    if (!selectedRepoId) return;
    setCalculating(true); setError(null);
    try {
      const data = await calculateAndPersistMetrics(selectedRepoId, windowDays);
      setMetrics(data); setLastUpdated(new Date());
    } catch { setError("Failed to calculate and persist metrics."); }
    finally { setCalculating(false); }
  };

  const selectedRepo = repos.find((r) => r._id === selectedRepoId);

  return (
    <PageShell
      title="Review & CI Metrics"
      subtitle={selectedRepo ? selectedRepo.fullName : undefined}
      actions={
        <>
          <RepoSelect repos={repos} value={selectedRepoId} onChange={setSelectedRepoId} />
          <WindowSelector value={windowDays} onChange={setWindowDays} />
          <PrimaryBtn onClick={handleCalculate} disabled={!selectedRepoId} loading={calculating}>⚡ Calculate</PrimaryBtn>
        </>
      }
    >
      {error && <ErrorAlert message={error} />}

      {!loading && !metrics && !error && repos.length === 0 && (
        <EmptyState
          icon="🚀"
          title="No repositories yet"
          description='Click "Seed" to load demo GitHub data and start analyzing.'
          action={<PrimaryBtn onClick={handleSeed} loading={seeding}>🌱 Seed Demo Data</PrimaryBtn>}
        />
      )}

      {(loading || metrics) && (
        <>
          {/* Tabs */}
          <Tabs<Tab>
            tabs={[
              { id: "metrics",   label: "Metrics Overview", icon: "📊" },
              { id: "charts",    label: "Charts",           icon: "📈" },
              { id: "prdetails", label: "PR Details",       icon: "🔀" },
            ]}
            active={tab}
            onChange={setTab}
          />

          {/* Tab: Metrics */}
          {tab === "metrics" && (
            <>
              <section>
                <SectionHeading
                  title="Key Performance Indicators"
                  subtitle={lastUpdated ? `Computed at ${lastUpdated.toLocaleTimeString()}` : `Last ${windowDays} days`}
                  right={
                    <button onClick={loadMetrics} disabled={!selectedRepoId || loading}
                      className="text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40">
                      {loading ? "Loading…" : "↻ Refresh"}
                    </button>
                  }
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <MetricCard
                    title="Review Pickup Time" icon="⏱️"
                    value={metrics?.reviewPickup.avgHours ?? null} unit="hrs avg"
                    subtitle={metrics ? `Median ${metrics.reviewPickup.medianHours?.toFixed(1) ?? "—"}h · ${metrics.reviewPickup.sampleSize} PRs` : undefined}
                    status={metrics?.reviewPickup.dataStatus ?? "ok"}
                    trend={getTrend(metrics?.reviewPickup.avgHours ?? null, { good: 4, warn: 12 })}
                    description="Time from PR opened to first review. Under 4 hrs is healthy."
                    isLoading={loading}
                  />
                  <MetricCard
                    title="Review Turnaround" icon="🔄"
                    value={metrics?.reviewTurnaround.avgHours ?? null} unit="hrs avg"
                    subtitle={metrics ? `Median ${metrics.reviewTurnaround.medianHours?.toFixed(1) ?? "—"}h · ${metrics.reviewTurnaround.sampleSize} PRs` : undefined}
                    status={metrics?.reviewTurnaround.dataStatus ?? "ok"}
                    trend={getTrend(metrics?.reviewTurnaround.avgHours ?? null, { good: 8, warn: 24 })}
                    description="Time from review request to final submission."
                    isLoading={loading}
                  />
                  <MetricCard
                    title="Load Concentration" icon="👤"
                    value={metrics?.reviewLoadConcentration.topReviewerPct ?? null} unit="% top reviewer"
                    subtitle={metrics ? `${metrics.reviewLoadConcentration.reviewerBreakdown.length} reviewers · ${metrics.reviewLoadConcentration.totalReviews} total` : undefined}
                    status={metrics?.reviewLoadConcentration.dataStatus ?? "ok"}
                    trend={getTrend(metrics?.reviewLoadConcentration.topReviewerPct ?? null, { good: 30, warn: 50 })}
                    description="Over 50% → bottleneck risk (R3)."
                    isLoading={loading}
                  />
                  <MetricCard
                    title="Failed Check Rate" icon="🔴"
                    value={metrics?.failedCheckRate.failedRatePct ?? null} unit="%"
                    subtitle={metrics ? `${metrics.failedCheckRate.failedRuns} failed / ${metrics.failedCheckRate.totalRuns} total` : undefined}
                    status={metrics?.failedCheckRate.dataStatus ?? "ok"}
                    trend={getTrend(metrics?.failedCheckRate.failedRatePct ?? null, { good: 10, warn: 25 })}
                    description="Over 25% → CI Friction Risk (R4)."
                    isLoading={loading}
                  />
                </div>
              </section>

              {/* Risk signals */}
              {metrics && <RiskSignals metrics={metrics} />}

              {/* Window meta */}
              {metrics && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-6 py-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                    {[
                      { label: "Window",   value: `${metrics.windowDays} days` },
                      { label: "From",     value: new Date(metrics.windowStart).toLocaleDateString() },
                      { label: "To",       value: new Date(metrics.windowEnd).toLocaleDateString()   },
                      { label: "Computed", value: new Date(metrics.computedAt).toLocaleTimeString()   },
                    ].map((m) => (
                      <div key={m.label}>
                        <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                        <p className="text-sm font-semibold text-slate-300">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Tab: Charts */}
          {tab === "charts" && metrics && (
            <section>
              <SectionHeading title="Distribution Charts" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                  <ReviewLoadChart
                    data={metrics.reviewLoadConcentration.reviewerBreakdown}
                    totalReviews={metrics.reviewLoadConcentration.totalReviews}
                  />
                  {metrics.reviewLoadConcentration.concentrationIndex !== null && (
                    <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-sm text-slate-400">Concentration Index (HHI)</span>
                      <span className={`text-base font-bold tabular-nums ${
                        metrics.reviewLoadConcentration.concentrationIndex > 50 ? "text-rose-400"
                        : metrics.reviewLoadConcentration.concentrationIndex > 30 ? "text-amber-400"
                        : "text-emerald-400"
                      }`}>
                        {metrics.reviewLoadConcentration.concentrationIndex.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                  <CheckRunsChart
                    data={metrics.failedCheckRate.checkBreakdown}
                    totalRuns={metrics.failedCheckRate.totalRuns}
                    failedRuns={metrics.failedCheckRate.failedRuns}
                  />
                </div>
              </div>
            </section>
          )}

          {/* Tab: PR Details */}
          {tab === "prdetails" && metrics && (
            <section>
              <SectionHeading
                title="PR Review Pickup Breakdown"
                subtitle="Time from PR opened to first review · sorted slowest first"
                right={
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Fast ≤4h</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />Moderate ≤12h</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />Slow &gt;12h</span>
                  </div>
                }
              />
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <PRPickupTable data={metrics.reviewPickup.perPR} />
              </div>
            </section>
          )}

          {/* Empty chart/pr states */}
          {(tab === "charts" || tab === "prdetails") && !metrics && !loading && (
            <EmptyState icon="📊" title="No data yet" description="Go to Metrics Overview tab and click Calculate to compute metrics first." />
          )}
        </>
      )}
    </PageShell>
  );
}
