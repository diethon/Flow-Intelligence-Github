import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { Repository, UC10MetricsResult } from "../types/metrics.js";
import { fetchRepositories, fetchReviewCIMetrics, calculateAndPersistMetrics } from "../api/metricsApi.js";
import { MetricCard } from "../components/MetricCard.js";
import { ReviewLoadChart } from "../components/ReviewLoadChart.js";
import { CheckRunsChart } from "../components/CheckRunsChart.js";
import { PRPickupTable } from "../components/PRPickupTable.js";
import {
  PageShell, Tabs, SectionHeading,
  PrimaryBtn, ErrorAlert, EmptyState,
  RepoSelect,
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
            ? <span className="text-sm font-bold bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg">{triggered.length} triggered</span>
            : <span className="text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-250 px-3 py-1.5 rounded-lg">All clear ✓</span>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {signals.map((s) => (
          <div key={s.rule} className={`rounded-2xl border p-6 ${s.triggered
              ? s.severity === "high" ? "bg-rose-50/50 border-rose-200 shadow-sm" : "bg-amber-50/50 border-amber-200 shadow-sm"
              : "bg-white border-slate-200 shadow-sm"
            }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{s.icon}</span>
                <div>
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${s.triggered ? "bg-rose-100 text-rose-700 border-rose-200/60" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                    {s.rule}
                  </span>
                </div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${s.triggered
                  ? s.severity === "high" ? "bg-rose-100 text-rose-700 border-rose-250" : "bg-amber-100 text-amber-700 border-amber-250"
                  : "bg-emerald-100 text-emerald-700 border-emerald-250"
                }`}>
                {s.triggered ? s.severity.toUpperCase() : "OK"}
              </span>
            </div>
            <p className="text-base font-semibold text-slate-800 mb-2">{s.label}</p>
            <p className="text-sm text-slate-500 leading-relaxed">{s.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ReviewCIMetricsPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
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
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<UC10MetricsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tab, setTab] = useState<Tab>("metrics");

  useEffect(() => {
    fetchRepositories()
      .then((data) => {
        setRepos(data);
        if (data.length > 0) {
          const cachedId = localStorage.getItem("selectedRepositoryId");
          const exists = data.some((r) => r._id === cachedId);
          setSelectedRepoId(exists && cachedId ? cachedId : data[0]._id);
        }
      })
      .catch(() => setRepos([]));
  }, []);

  const handleSelectRepo = (id: string) => {
    setSelectedRepoId(id);
    localStorage.setItem("selectedRepositoryId", id);
    window.dispatchEvent(new Event("repoChanged"));
  };

  const loadMetrics = useCallback(async () => {
    if (!selectedRepoId) return;
    setLoading(true); setError(null);
    try {
      const data = await fetchReviewCIMetrics(
        selectedRepoId,
        windowDays,
        startDate || undefined,
        endDate || undefined
      );
      setMetrics(data); setLastUpdated(new Date());
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError("You do not have permission to view or calculate metrics for this repository.");
      } else {
        setError("Failed to load metrics. Make sure the backend is running.");
      }
      setMetrics(null);
    } finally { setLoading(false); }
  }, [selectedRepoId, windowDays, startDate, endDate]);

  useEffect(() => { if (selectedRepoId) loadMetrics(); }, [selectedRepoId, windowDays, startDate, endDate, loadMetrics]);


  const handleCalculate = async () => {
    if (!selectedRepoId) return;
    setCalculating(true); setError(null);
    try {
      const data = await calculateAndPersistMetrics(
        selectedRepoId,
        windowDays,
        startDate || undefined,
        endDate || undefined
      );
      setMetrics(data); setLastUpdated(new Date());
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError("You do not have permission to run calculation for this repository.");
      } else {
        setError("Failed to calculate and persist metrics.");
      }
    }
    finally { setCalculating(false); }
  };

  return (
    <PageShell
      title="Review & CI Metrics"

      actions={
        <>
          <RepoSelect repos={repos} value={selectedRepoId} onChange={handleSelectRepo} />
          <PrimaryBtn onClick={handleCalculate} disabled={!selectedRepoId} loading={calculating}>⚡ Calculate</PrimaryBtn>
        </>
      }
    >
      {error && <ErrorAlert message={error} />}

      {!loading && !metrics && !error && repos.length === 0 && (
        <EmptyState
          icon="🚀"
          title="No repositories yet"
          description="Connect a GitHub repository to start analyzing."
          action={<PrimaryBtn onClick={() => navigate("/repositories/connect")}>🔌 Connect Repository</PrimaryBtn>}
        />
      )}

      {(loading || metrics) && (
        <>
          {/* Tabs */}
          <Tabs<Tab>
            tabs={[
              { id: "metrics", label: "Metrics Overview", icon: "📊" },
              { id: "charts", label: "Charts", icon: "📈" },
              { id: "prdetails", label: "PR Details", icon: "🔀" },
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
                  subtitle={
                    windowDays === 0
                      ? (startDate && endDate ? `From ${startDate} to ${endDate}` : "All Time")
                      : lastUpdated
                        ? `Computed at ${lastUpdated.toLocaleTimeString()}`
                        : `Last ${windowDays} days`
                  }
                  right={
                    <button onClick={loadMetrics} disabled={!selectedRepoId || loading}
                      className="text-sm text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-350 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40">
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
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                    {[
                      { label: "Window", value: `${metrics.windowDays} days` },
                      { label: "From", value: new Date(metrics.windowStart).toLocaleDateString() },
                      { label: "To", value: new Date(metrics.windowEnd).toLocaleDateString() },
                      { label: "Computed", value: new Date(metrics.computedAt).toLocaleTimeString() },
                    ].map((m) => (
                      <div key={m.label}>
                        <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                        <p className="text-sm font-semibold text-slate-850">{m.value}</p>
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
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
                  <ReviewLoadChart
                    data={metrics.reviewLoadConcentration.reviewerBreakdown}
                    totalReviews={metrics.reviewLoadConcentration.totalReviews}
                  />
                  {metrics.reviewLoadConcentration.concentrationIndex !== null && (
                    <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-sm text-slate-500">Concentration Index (HHI)</span>
                      <span className={`text-base font-bold tabular-nums ${metrics.reviewLoadConcentration.concentrationIndex > 50 ? "text-rose-600"
                          : metrics.reviewLoadConcentration.concentrationIndex > 30 ? "text-amber-600"
                            : "text-emerald-600"
                        }`}>
                        {metrics.reviewLoadConcentration.concentrationIndex.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
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
                  <div className="flex items-center gap-4 text-xs text-slate-600">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Fast ≤4h</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />Moderate ≤12h</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />Slow &gt;12h</span>
                  </div>
                }
              />
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
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
