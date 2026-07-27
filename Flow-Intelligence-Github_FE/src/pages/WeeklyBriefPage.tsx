import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { PageShell, PrimaryBtn, GhostBtn } from "../components/PageShell";
import { briefApi, type AiBriefData } from "../api/briefApi";
import { RepoSelect } from "../components/PageShell";
import { fetchDashboardRepositories } from "../api/dashboardApi";
import type { Repository } from "../types/dashboard";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { PartialDataState } from "../components/PartialDataState";
import { getEvidenceCards } from "../services/evidenceService";
import { fetchReviewCIMetrics } from "../api/metricsApi";
import type { EvidenceCard } from "../types";
import type { UC10MetricsResult } from "../types/metrics";
import { exportWeeklyReportCsv, exportWeeklyReportPdf } from "../utils/reportExport";
import { BriefComparisonView } from "../components/BriefComparisonView";
import { useAuth } from "../hooks/useAuth";
import { canManageWeeklyBrief, getPermissionErrorMessage } from "../utils/modulePermissions";

export function WeeklyBriefPage() {
  const { user } = useAuth();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [brief, setBrief] = useState<AiBriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evidenceCards, setEvidenceCards] = useState<EvidenceCard[]>([]);
  const [metrics, setMetrics] = useState<UC10MetricsResult | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportMenuPosition, setExportMenuPosition] = useState({ top: 0, right: 0 });
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const selectedRepository = repos.find((repo) => repo._id === selectedRepoId);
  const canManage = canManageWeeklyBrief({
    globalRole: user?.role,
    repositoryRole: selectedRepository?.role,
  });
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );

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
      .catch(() => {
        setError("Failed to load repositories");
        setLoading(false);
      });
  }, []);

  const positionExportMenu = useCallback(() => {
    const button = exportButtonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setExportMenuPosition({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, []);

  useEffect(() => {
    if (!exportMenuOpen) return;
    positionExportMenu();

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !exportButtonRef.current?.contains(target) &&
        !exportMenuRef.current?.contains(target)
      ) {
        setExportMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExportMenuOpen(false);
        exportButtonRef.current?.focus();
      }
    };
    const closeOnScroll = () => setExportMenuOpen(false);

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", positionExportMenu);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", positionExportMenu);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [exportMenuOpen, positionExportMenu]);

  const loadBriefs = async () => {
    if (!selectedRepoId) return;
    setLoading(true);
    setError(null);
    try {
      const briefs = await briefApi.getBriefs(selectedRepoId);
      if (briefs && briefs.length > 0) {
        setBrief(briefs[0]);
      } else {
        setBrief(null);
      }
    } catch (err: unknown) {
      setError(getPermissionErrorMessage(err, "Failed to load briefs"));
    } finally {
      setLoading(false);
    }
  };

  const loadReportDetails = async () => {
    if (!selectedRepoId) return;
    if (!canManage) {
      setEvidenceCards([]);
      setMetrics(null);
      return;
    }
    const [evidenceResult, metricsResult] = await Promise.allSettled([
      getEvidenceCards(selectedRepoId, { limit: 100 }),
      fetchReviewCIMetrics(selectedRepoId, 7, startDate, endDate),
    ]);
    if (evidenceResult.status === "fulfilled") {
      const from = new Date(`${startDate}T00:00:00.000Z`).getTime();
      const to = new Date(`${endDate}T23:59:59.999Z`).getTime();
      setEvidenceCards((evidenceResult.value.data ?? []).filter(card => {
        const createdAt = new Date(card.createdAt).getTime();
        return createdAt >= from && createdAt <= to;
      }));
    } else {
      setEvidenceCards([]);
    }
    setMetrics(metricsResult.status === "fulfilled" ? metricsResult.value : null);
  };

  useEffect(() => {
    if (selectedRepoId) {
      loadBriefs();
      loadReportDetails();
    }
  }, [selectedRepoId, canManage]);

  const handleGenerate = async () => {
    if (!selectedRepoId) return;
    setLoading(true);
    setError(null);
    try {
      const startIso = new Date(startDate).toISOString();
      const endIso = new Date(endDate + 'T23:59:59.999Z').toISOString();
      const generated = await briefApi.generateBrief(selectedRepoId, startIso, endIso);
      setBrief(generated);
      await loadReportDetails();
    } catch (err: unknown) {
      setError(getPermissionErrorMessage(err, "Failed to generate brief"));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRepo = (id: string) => {
    setSelectedRepoId(id);
    localStorage.setItem("selectedRepositoryId", id);
    window.dispatchEvent(new Event("selectedRepositoryChanged"));
  };

  const handlePublish = async () => {
    if (!brief || !selectedRepoId) return;
    setLoading(true);
    setError(null);
    try {
      setBrief(await briefApi.publishBrief(selectedRepoId, brief._id));
    } catch (err: unknown) {
      setError(getPermissionErrorMessage(err, "Failed to publish brief"));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: "pdf" | "csv") => {
    if (!brief) return;
    setExportMenuOpen(false);
    setExportError(null);
    const report = {
      brief,
      repositoryName: repos.find(repo => repo._id === selectedRepoId)?.fullName ?? "Repository",
      evidenceCards,
      metrics,
    };
    try {
      if (format === "pdf") exportWeeklyReportPdf(report);
      else exportWeeklyReportCsv(report);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Could not export report");
    }
  };

  return (
    <PageShell
      title="AI Weekly Brief"
      actions={
        repos.length > 0 ? (
          <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
            <div className="min-w-0 max-w-full [&>select]:min-w-0 [&>select]:max-w-full">
              <RepoSelect repos={repos} value={selectedRepoId} onChange={handleSelectRepo} />
            </div>
            <div className="hidden lg:flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-2 shadow-sm">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none focus:ring-0 text-slate-700 py-1.5 outline-none cursor-pointer" />
              <span>→</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none focus:ring-0 text-slate-700 py-1.5 outline-none cursor-pointer" />
            </div>
            <GhostBtn onClick={loadBriefs} disabled={loading}>↻ Refresh</GhostBtn>
            <GhostBtn onClick={() => setShowComparison(value => !value)} disabled={loading || !brief}>{showComparison ? "Hide Comparison" : "Compare Periods"}</GhostBtn>
            {loading || !brief ? (
              <GhostBtn onClick={() => undefined} disabled>
                Export <span aria-hidden="true" className="text-xs">▾</span>
              </GhostBtn>
            ) : (
              <div className="relative">
                <button
                  ref={exportButtonRef}
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={exportMenuOpen}
                  aria-controls="weekly-brief-export-menu"
                  onClick={() => {
                    positionExportMenu();
                    setExportMenuOpen(value => !value);
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
                >
                  Export
                  <span
                    aria-hidden="true"
                    className={`text-xs transition-transform ${exportMenuOpen ? "rotate-180" : ""}`}
                  >
                    ▾
                  </span>
                </button>
                {exportMenuOpen && createPortal(
                  <div
                    ref={exportMenuRef}
                    id="weekly-brief-export-menu"
                    role="menu"
                    aria-label="Export weekly brief"
                    style={{ top: exportMenuPosition.top, right: exportMenuPosition.right }}
                    className="fixed z-[100] w-40 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleExport("csv")}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleExport("pdf")}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    >
                      Export PDF
                    </button>
                  </div>,
                  document.body
                )}
              </div>
            )}
            {canManage && brief?.publicationStatus === "draft" && (
              <GhostBtn onClick={handlePublish} disabled={loading}>Publish</GhostBtn>
            )}
            {canManage && <PrimaryBtn onClick={handleGenerate} disabled={loading}>✨ Generate</PrimaryBtn>}
          </div>
        ) : undefined
      }
    >
      {error && <ErrorState message={error} retryAction={loadBriefs} />}
      {exportError && <ErrorState message={exportError} />}
      {showComparison && selectedRepoId && <BriefComparisonView repositoryId={selectedRepoId} onClose={() => setShowComparison(false)} />}

      {loading && !brief && <LoadingState message="Fetching your latest AI Brief..." />}

      {!loading && !error && !brief && repos.length > 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
          <span className="text-6xl mb-4">🤖</span>
          <h3 className="text-xl font-bold text-slate-800">No Weekly Brief Found</h3>
          <p className="text-slate-500 mb-6 max-w-md text-center text-sm">
            Generate your first AI-powered Weekly Brief to get a quick summary of team workflow risks and predictions.
          </p>
          {canManage ? (
            <PrimaryBtn onClick={handleGenerate}>✨ Generate Brief Now</PrimaryBtn>
          ) : (
            <p className="text-sm font-medium text-slate-600">
              No published Weekly Brief is available.
            </p>
          )}
        </div>
      )}

      {brief && !loading && (
        <div className="min-w-0 space-y-6">
          {canManage && (
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {brief.publicationStatus === "published" ? "Published" : "Draft"}
            </div>
          )}
          {brief.isFallback && (
            <PartialDataState message="AI Service Unavailable" missingData={["Deterministic rules used for fallback brief."]} />
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Executive Summary</h2>
            <p className="break-words text-slate-700 leading-relaxed">{brief.summary}</p>
          </div>

          {brief.items.some(i => i.type === "trend_comparison") && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-4">📈 Trend Analysis</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {brief.items.filter(i => i.type === "trend_comparison").map((item, idx) => (
                  <div key={idx} className="min-w-0 bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <h4 className="break-words font-semibold text-blue-900 mb-1">{item.title}</h4>
                    <p className="break-words text-sm text-blue-800">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Key Insights</h3>
              <ul className="space-y-3">
                {brief.items.filter(i => i.type === "risk_summary").map((item, idx) => (
                  <li key={idx} className="border-l-4 border-amber-400 pl-3">
                    <h4 className="break-words font-semibold text-slate-800">{item.title}</h4>
                    <p className="break-words text-sm text-slate-600">{item.detail}</p>
                  </li>
                ))}
                {brief.items.filter(i => i.type === "risk_summary").length === 0 && (
                  <p className="text-sm text-slate-500 italic">No significant risks identified.</p>
                )}
              </ul>
            </div>

            <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Recommendations</h3>
              <ul className="space-y-3">
                {brief.items.filter(i => i.type === "recommendation").map((item, idx) => (
                  <li key={idx} className="border-l-4 border-emerald-400 pl-3">
                    <h4 className="break-words font-semibold text-slate-800">{item.title}</h4>
                    <p className="break-words text-sm text-slate-600">{item.detail}</p>
                  </li>
                ))}
                {brief.items.filter(i => i.type === "recommendation").length === 0 && (
                  <p className="text-sm text-slate-500 italic">No specific recommendations at this time.</p>
                )}
              </ul>
            </div>
          </div>

          {brief.limitations && brief.limitations.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">Limitations & Context</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-500">
                {brief.limitations.map((lim, idx) => (
                  <li key={idx} className="break-words">{lim}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
