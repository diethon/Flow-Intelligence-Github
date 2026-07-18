import { useState, useEffect } from "react";
import { PageShell, SectionHeading, PrimaryBtn, GhostBtn } from "../components/PageShell";
import { briefApi, type AiBriefData } from "../api/briefApi";
import { RepoSelect } from "../components/PageShell";
import { fetchDashboardRepositories } from "../api/dashboardApi";
import type { Repository } from "../types/dashboard";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { PartialDataState } from "../components/PartialDataState";

export function WeeklyBriefPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [brief, setBrief] = useState<AiBriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      .catch((err) => {
        setError("Failed to load repositories");
        setLoading(false);
      });
  }, []);

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
    } catch (err: any) {
      setError(err.message || "Failed to load briefs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRepoId) {
      loadBriefs();
    }
  }, [selectedRepoId]);

  const handleGenerate = async () => {
    if (!selectedRepoId) return;
    setLoading(true);
    setError(null);
    try {
      const startIso = new Date(startDate).toISOString();
      const endIso = new Date(endDate + 'T23:59:59.999Z').toISOString();
      const generated = await briefApi.generateBrief(selectedRepoId, startIso, endIso);
      setBrief(generated);
    } catch (err: any) {
      setError(err.message || "Failed to generate brief");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRepo = (id: string) => {
    setSelectedRepoId(id);
    localStorage.setItem("selectedRepositoryId", id);
  };

  return (
    <PageShell
      title="AI Weekly Brief"
      actions={
        repos.length > 0 ? (
          <div className="flex items-center gap-3">
            <RepoSelect repos={repos} value={selectedRepoId} onChange={handleSelectRepo} />
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-2 shadow-sm">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none focus:ring-0 text-slate-700 py-1.5 outline-none cursor-pointer" />
              <span>→</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none focus:ring-0 text-slate-700 py-1.5 outline-none cursor-pointer" />
            </div>
            <GhostBtn onClick={loadBriefs} disabled={loading}>↻ Refresh</GhostBtn>
            <PrimaryBtn onClick={handleGenerate} disabled={loading}>✨ Generate</PrimaryBtn>
          </div>
        ) : undefined
      }
    >
      {error && <ErrorState message={error} retryAction={loadBriefs} />}
      
      {loading && !brief && <LoadingState message="Fetching your latest AI Brief..." />}

      {!loading && !error && !brief && repos.length > 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
          <span className="text-6xl mb-4">🤖</span>
          <h3 className="text-xl font-bold text-slate-800">No Weekly Brief Found</h3>
          <p className="text-slate-500 mb-6 max-w-md text-center text-sm">
            Generate your first AI-powered Weekly Brief to get a quick summary of team workflow risks and predictions.
          </p>
          <PrimaryBtn onClick={handleGenerate}>✨ Generate Brief Now</PrimaryBtn>
        </div>
      )}

      {brief && !loading && (
        <div className="space-y-6">
          {brief.isFallback && (
            <PartialDataState message="AI Service Unavailable" missingData={["Deterministic rules used for fallback brief."]} />
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Executive Summary</h2>
            <p className="text-slate-700 leading-relaxed">{brief.summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Key Insights</h3>
              <ul className="space-y-3">
                {brief.items.filter(i => i.type === "risk_summary").map((item, idx) => (
                  <li key={idx} className="border-l-4 border-amber-400 pl-3">
                    <h4 className="font-semibold text-slate-800">{item.title}</h4>
                    <p className="text-sm text-slate-600">{item.detail}</p>
                  </li>
                ))}
                {brief.items.filter(i => i.type === "risk_summary").length === 0 && (
                  <p className="text-sm text-slate-500 italic">No significant risks identified.</p>
                )}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Recommendations</h3>
              <ul className="space-y-3">
                {brief.items.filter(i => i.type === "recommendation").map((item, idx) => (
                  <li key={idx} className="border-l-4 border-emerald-400 pl-3">
                    <h4 className="font-semibold text-slate-800">{item.title}</h4>
                    <p className="text-sm text-slate-600">{item.detail}</p>
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
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
