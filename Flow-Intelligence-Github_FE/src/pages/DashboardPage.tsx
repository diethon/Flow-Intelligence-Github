import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchDashboardRepositories, fetchDashboard } from "../api/dashboardApi.js";
import type { DashboardSummary, Repository, RiskLevel } from "../types/dashboard.js";
import { DashboardKPICard } from "../components/DashboardKPICard.js";
import { BottleneckCard } from "../components/BottleneckCard.js";
import {
  PageShell, SectionHeading,
  RepoSelect,
  ErrorAlert, EmptyState,
  PrimaryBtn, GhostBtn
} from "../components/PageShell.js";
import { RiskBadge } from "../components/RiskBadge.js";
import { SyncStatusCard } from "../components/SyncStatusCard.js";
import { EvidenceCardRow } from "../components/EvidenceCardRow.js";
import { PredictionCard } from "../components/PredictionCard.js";
import { useSyncStatus } from "../hooks/useSyncStatus.js";
import { DataQualityPanel } from "../components/DataQualityPanel.js";

// Overall risk layout styles for Light Mode
const OVERALL_CARD_THEME: Record<RiskLevel, { border: string; bg: string; text: string; glow: string }> = {
  high: {
    border: "border-rose-200",
    bg: "bg-gradient-to-r from-rose-100/50 via-rose-50/20 to-transparent",
    text: "text-rose-800",
    glow: "shadow-rose-100/20"
  },
  medium: {
    border: "border-amber-200",
    bg: "bg-gradient-to-r from-amber-100/50 via-amber-50/20 to-transparent",
    text: "text-amber-800",
    glow: "shadow-amber-100/20"
  },
  low: {
    border: "border-yellow-200",
    bg: "bg-gradient-to-r from-yellow-100/50 via-yellow-50/20 to-transparent",
    text: "text-yellow-800",
    glow: "shadow-yellow-100/20"
  },
  good: {
    border: "border-emerald-200",
    bg: "bg-gradient-to-r from-emerald-100/50 via-emerald-50/20 to-transparent",
    text: "text-emerald-800",
    glow: "shadow-emerald-100/20"
  }
};

const OVERALL_STATUS_MESSAGES: Record<RiskLevel, string> = {
  high: "Multiple delivery bottlenecks detected. Immediate intervention is highly recommended to improve flow and resolve friction.",
  medium: "Some flow risk rules have exceeded their thresholds. Plan a review with the team to identify areas of review or CI improvement.",
  low: "Minor risks detected. Workflow metrics are mostly stable. Monitor the situation to prevent further delays.",
  good: "All delivery metrics are well within healthy thresholds. The development pipeline is flowing smoothly. 🎉"
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [windowDays, setWindowDays] = useState(() => {
    const cached = localStorage.getItem("selectedWindowDays");
    return cached ? parseInt(cached, 10) : 7;
  });
  const [startDate, setStartDate] = useState(() => {
    const cachedDays = localStorage.getItem("selectedWindowDays");
    const days = cachedDays ? parseInt(cachedDays, 10) : 7;
    if (days > 0) {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - days);
      const val = start.toISOString().split("T")[0];
      localStorage.setItem("selectedStartDate", val);
      return val;
    }
    const cachedStart = localStorage.getItem("selectedStartDate");
    if (cachedStart) return cachedStart;
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    const val = start.toISOString().split("T")[0];
    localStorage.setItem("selectedStartDate", val);
    return val;
  });
  const [endDate, setEndDate] = useState(() => {
    const cachedDays = localStorage.getItem("selectedWindowDays");
    const days = cachedDays ? parseInt(cachedDays, 10) : 7;
    if (days > 0) {
      const val = new Date().toISOString().split("T")[0];
      localStorage.setItem("selectedEndDate", val);
      return val;
    }
    const cachedEnd = localStorage.getItem("selectedEndDate");
    if (cachedEnd) return cachedEnd;
    const val = new Date().toISOString().split("T")[0];
    localStorage.setItem("selectedEndDate", val);
    return val;
  });
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: syncData, isLoading: syncLoading } = useSyncStatus(selectedRepoId);
  const syncStatus = syncData?.data?.syncStatus;
  // Load repository options and check localStorage cache
  useEffect(() => {
    fetchDashboardRepositories()
      .then((data) => {
        setRepos(data);
        if (data.length > 0) {
          const cachedId = localStorage.getItem("selectedRepositoryId");
          const exists = data.some((r) => r._id === cachedId);
          setSelectedRepoId(exists && cachedId ? cachedId : data[0]._id);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load repositories:", err);
        setError("Failed to fetch repositories. Please check backend connection.");
        setLoading(false);
      });
  }, []);

  // Fetch dashboard details for selected repo
  const loadDashboardData = useCallback(async () => {
    if (!selectedRepoId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboard(
        selectedRepoId,
        windowDays,
        startDate || undefined,
        endDate || undefined
      );
      setSummary(data);
    } catch (err) {
      console.error("Failed to load dashboard metrics:", err);
      setError("Could not load dashboard analytics. Verify the backend connection and database sync state.");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [selectedRepoId, windowDays, startDate, endDate]);

  useEffect(() => {
    if (selectedRepoId) {
      loadDashboardData();
    }
  }, [selectedRepoId, windowDays, startDate, endDate, loadDashboardData]);

  const handleSelectRepo = (id: string) => {
    setSelectedRepoId(id);
    localStorage.setItem("selectedRepositoryId", id);
  };

  const selectedRepo = repos.find((r) => r._id === selectedRepoId);
  const overallTheme = summary ? OVERALL_CARD_THEME[summary.overallRiskLevel] : OVERALL_CARD_THEME.good;

  return (
    <PageShell
      title="Team Flow Dashboard"

      actions={
        repos.length > 0 ? (
          <>
            <RepoSelect repos={repos} value={selectedRepoId} onChange={handleSelectRepo} />
            <GhostBtn onClick={loadDashboardData} disabled={loading}>
              ↻ Refresh
            </GhostBtn>
          </>
        ) : undefined
      }
    >
      {error && <ErrorAlert message={error} />}

      {/* Empty State: No connected repos */}
      {!loading && repos.length === 0 && (
        <EmptyState
          icon="🔌"
          title="No connected repositories found"
          description="Connect your first GitHub repository to view team flow analytics, rulebook evaluation, and delivery KPIs."
          action={
            <PrimaryBtn onClick={() => navigate("/repositories/connect")}>
              🔌 Connect Repository
            </PrimaryBtn>
          }
        />
      )}

      {/* Loading state placeholders */}
      {loading && !summary && (
        <div className="space-y-6">
          <div className="h-40 rounded-2xl bg-white animate-pulse border border-slate-200" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-white animate-pulse border border-slate-200" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-white animate-pulse border border-slate-200" />
        </div>
      )}

      {/* Main dashboard content */}
      {!loading && summary && (
        <div className="space-y-8 animate-fadeIn">
          {/* Overall Risk Hero Section (UC13) */}
          <section className={`rounded-2xl border p-6 md:p-8 shadow-sm bg-white ${overallTheme.border} ${overallTheme.bg} ${overallTheme.glow}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-3">
                  <RiskBadge level={summary.overallRiskLevel} size="lg" />
                  <span className="text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 px-3 py-1 rounded-full uppercase tracking-wider">
                    Rulebook Evaluation
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">
                  Pipeline Status is {summary.overallRiskLevel === "good" ? "Healthy" : summary.overallRiskLevel.toUpperCase() + " RISK"}
                </h2>
                <p className={`text-sm leading-relaxed max-w-2xl ${overallTheme.text}`}>
                  {OVERALL_STATUS_MESSAGES[summary.overallRiskLevel]}
                </p>
              </div>

              {/* Counter and quick action */}
              <div className="flex flex-col sm:flex-row items-center gap-5 flex-shrink-0 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-extrabold text-rose-500 tabular-nums">{summary.triggeredRuleCount}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Triggered</p>
                  </div>
                  <div className="text-slate-300 text-xl font-thin">/</div>
                  <div className="text-center">
                    <p className="text-3xl font-extrabold text-slate-500 tabular-nums">{summary.bottlenecks.length}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Total Rules</p>
                  </div>
                </div>

                <div className="w-px h-10 bg-slate-200 hidden sm:block" />

                <PrimaryBtn onClick={() => navigate("/risk")}>
                  🔍 View Evidence
                </PrimaryBtn>
              </div>
            </div>
          </section>

          {/* KPI Metrics Grid (UC10) */}
          <section>
            <SectionHeading
              title="Team Flow Key Metrics"
              subtitle={
                windowDays === 0
                  ? (startDate && endDate ? `Normalized metrics calculated from ${startDate} to ${endDate}` : "Normalized metrics calculated over all time")
                  : `Normalized metrics calculated over the last ${windowDays} days`
              }
              right={
                <GhostBtn onClick={() => navigate("/review-ci")}>
                  📊 Detailed Metrics →
                </GhostBtn>
              }
            />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {summary.kpis.map((kpi) => (
                <DashboardKPICard key={kpi.key} card={kpi} />
              ))}
            </div>
          </section>

          {/* Active Bottlenecks & Rulebook Summary (UC11 & UC12 & UC14) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Bottlenecks summary list (UC12) */}
            <div className="lg:col-span-2 space-y-8">
              <div className="space-y-5">
              <SectionHeading
                title="Active Delivery Bottlenecks"
                subtitle="Rules prioritized by status and severity"
              />
              <div className="space-y-4">
                {summary.bottlenecks.map((btn) => (
                  <BottleneckCard
                    key={btn.ruleCode}
                    card={btn}
                    onDrillDown={() => navigate("/risk")}
                  />
                ))}
              </div>
            </div>

            {/* Recent Risk Intelligence & Evidence (UC15 & UC16) */}
              <section className="space-y-6 pt-2 border-t border-slate-100">
                <SectionHeading
                  title="Recent Risk Intelligence & Evidence"
                  subtitle="Latest AI predictions and evidence items across the repository"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* AI Predictions */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">PR Delay Predictions</h3>
                    {summary.recentPredictions && summary.recentPredictions.length > 0 ? (
                      summary.recentPredictions.map((pred: any) => (
                        <PredictionCard
                          key={pred._id}
                          prediction={pred}
                          prNumber={pred.pullRequestId?.number}
                          prTitle={pred.pullRequestId?.title || `Pull Request #${pred.pullRequestId?.number}`}
                          onClick={() => {
                            if (pred.pullRequestId?.prUrl) {
                              window.open(pred.pullRequestId.prUrl, '_blank');
                            }
                          }}
                        />
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 italic">No recent PR delay predictions.</p>
                    )}
                  </div>

                  {/* Evidence Cards */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2">Latest Evidence</h3>
                    {summary.recentEvidenceCards && summary.recentEvidenceCards.length > 0 ? (
                      summary.recentEvidenceCards.map((card: any) => (
                        <EvidenceCardRow key={card._id} card={card} to={`/risk/${card._id}`} />
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 italic">No recent evidence cards.</p>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* Quick insights, rulebook definitions, and data quality check (UC06 & UC14) */}
            <div className="space-y-6">
              {/* Quick actions for Sync Status & PRs */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                  🚀 Repository Shortcuts
                </h3>
                <div className="space-y-3 text-xs">
                  <button
                    onClick={() => navigate(`/repositories/${selectedRepoId}/sync-status`)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-indigo-300 transition-all text-left bg-white shadow-sm"
                  >
                    <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center text-lg flex-shrink-0">
                      🔄
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Repository Sync Status</p>
                      <p className="text-[10px] text-slate-500 font-medium">View backfill jobs & log</p>
                    </div>
                  </button>

                  <button
                    onClick={() => navigate(`/repositories/${selectedRepoId}/pull-requests`)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-indigo-300 transition-all text-left bg-white shadow-sm"
                  >
                    <div className="h-9 w-9 rounded-lg bg-purple-50 flex items-center justify-center text-lg flex-shrink-0">
                      🔀
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">View Pull Requests</p>
                      <p className="text-[10px] text-slate-500 font-medium">Inspect pull request details</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Data Quality Banner (UC06) */}
              <DataQualityPanel repositoryId={selectedRepoId} />

              {/* Sync Status Card (UC03) */}
              {syncStatus && (
                <SyncStatusCard
                  status={syncStatus.status}
                  lastSyncAt={syncStatus.lastSyncAt}
                  pendingJobs={syncStatus.pendingJobs}
                  currentRun={syncStatus.currentRun}
                />
              )}

              {/* Quick links & Rulebook Info (UC14) */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">
                  📋 Flow Rulebook
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Metrics are analyzed against 5 team-level flow rules (R1 to R5) configured in the rulebook.
                </p>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">R1: Stale PRs</span>
                    <span className="font-semibold text-slate-700">≥ 3 PRs</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">R2: Review Pickup Delay</span>
                    <span className="font-semibold text-slate-700">≥ 12 hrs</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">R3: Review Concentration</span>
                    <span className="font-semibold text-slate-700">≥ 50%</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">R4: CI Friction Rate</span>
                    <span className="font-semibold text-slate-700">≥ 25%</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">R5: Oversized PRs</span>
                    <span className="font-semibold text-slate-700">≥ 2 PRs</span>
                  </div>
                </div>
                <div className="pt-2">
                  <PrimaryBtn onClick={() => navigate("/rulebook")}>
                    📋 Manage Rulebook
                  </PrimaryBtn>
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="rounded-2xl border border-slate-200 bg-slate-100/50 p-5">
                <p className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1.5">
                  🔒 Privacy Guardrails
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Calculated metrics are restricted to team workflow indicators. HR monitoring, developer rating, and raw source code reading are strictly disabled.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}
    </PageShell>
  );
};

export default DashboardPage;
