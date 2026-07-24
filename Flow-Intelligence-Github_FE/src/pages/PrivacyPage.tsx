import { useState, useEffect } from "react";
import { PageShell, SectionHeading, PrimaryBtn, GhostBtn } from "../components/PageShell";
import { RepoSelect } from "../components/PageShell";
import { fetchDashboardRepositories } from "../api/dashboardApi";
import type { Repository } from "../types/dashboard";
import { privacyApi, type PrivacySettingsData } from "../api/privacyApi";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";

export function PrivacyPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [settings, setSettings] = useState<PrivacySettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const loadSettings = async () => {
    if (!selectedRepoId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await privacyApi.getSettings(selectedRepoId);
      setSettings(data);
    } catch (err: any) {
      setError(err.message || "Failed to load privacy settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRepoId) {
      loadSettings();
    }
  }, [selectedRepoId]);

  const handleSelectRepo = (id: string) => {
    setSelectedRepoId(id);
    localStorage.setItem("selectedRepositoryId", id);
  };

  const handleToggle = (key: keyof PrivacySettingsData) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: !settings[key] });
  };

  const handleNumberChange = (key: keyof PrivacySettingsData, val: number) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: val });
  };

  const handleSave = async () => {
    if (!selectedRepoId || !settings) return;
    setSaving(true);
    setError(null);
    try {
      await privacyApi.updateSettings(selectedRepoId, settings);
      setToastMessage("Privacy settings saved successfully!");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save privacy settings");
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteData = async () => {
    if (!selectedRepoId) return;
    setDeleting(true);
    setError(null);
    try {
      const msg = await privacyApi.deleteData(selectedRepoId);
      setShowDeleteModal(false);
      setToastMessage(msg || "All repository data purged successfully.");
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to delete repository data");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageShell
      title="Privacy & Security"
      actions={
        repos.length > 0 ? (
          <>
            <RepoSelect repos={repos} value={selectedRepoId} onChange={handleSelectRepo} />
            <PrimaryBtn onClick={handleSave} disabled={saving || loading || deleting}>
              {saving ? "Saving..." : "💾 Save Changes"}
            </PrimaryBtn>
          </>
        ) : undefined
      }
    >
      {error && <ErrorState message={error} retryAction={loadSettings} />}
      
      {loading && !settings && <LoadingState message="Loading privacy settings..." />}

      {!loading && !error && settings && (
        <div className="space-y-8 max-w-4xl">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
            <SectionHeading title="AI Payload Settings" subtitle="Control what data is sent to AI models for analysis." />
            
            <div className="space-y-6 mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-800">Pseudonymize Contributors</h4>
                  <p className="text-sm text-slate-500 max-w-lg">Mask actual developer names with hash-based pseudonyms before generating AI reports.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={settings.pseudonymizeContributors} onChange={() => handleToggle("pseudonymizeContributors")} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                <div>
                  <h4 className="font-semibold text-slate-800">Minimum Group Size</h4>
                  <p className="text-sm text-slate-500 max-w-lg">Minimum number of contributors required in a group before generating per-group breakdowns (prevents individual performance tracking).</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={settings.minimumGroupSize ?? 3}
                    onChange={(e) => handleNumberChange("minimumGroupSize", parseInt(e.target.value) || 3)}
                    className="w-20 px-3 py-1.5 border border-slate-300 rounded-lg text-center font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-sm text-slate-500 font-medium">members</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                <div>
                  <h4 className="font-semibold text-slate-800">Exclude Raw Comments</h4>
                  <p className="text-sm text-slate-500 max-w-lg">Prevent raw pull request comments and review text from being included in AI payloads.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={settings.excludeRawComments} onChange={() => handleToggle("excludeRawComments")} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                <div>
                  <h4 className="font-semibold text-slate-800">Exclude Source Code Diffs</h4>
                  <p className="text-sm text-slate-500 max-w-lg">Ensure no actual source code snippets are sent to external AI providers.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={settings.excludeRawCode} onChange={() => handleToggle("excludeRawCode")} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
            <SectionHeading title="Data Sharing & Retention" subtitle="Manage how your data is retained and shared." />
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 text-sm text-slate-700">
              <strong className="block text-slate-900 mb-2">Prohibited Use Notice:</strong>
              Data generated by this platform is strictly for identifying process bottlenecks. It must not be used for individual performance evaluation, compensation decisions, or HR punitive actions.
            </div>

            <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-800 text-rose-600">Request Data Deletion</h4>
                  <p className="text-sm text-slate-500 max-w-lg">Permanently delete or anonymize all records, predictions, and analytics for this repository.</p>
                </div>
                <GhostBtn onClick={() => setShowDeleteModal(true)} disabled={deleting || loading}>
                  <span className="text-rose-600">{deleting ? "Purging..." : "🗑️ Delete Data"}</span>
                </GhostBtn>
              </div>
          </section>
        </div>
      )}

      {/* Confirmation Modal for Data Deletion */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center gap-4 text-rose-600">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Confirm Data Deletion</h3>
                <p className="text-xs text-slate-500 font-mono">Repo ID: {selectedRepoId}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete all analytics data for this repository? 
              This action <strong className="text-rose-600 font-semibold">cannot be undone</strong> and will purge all synced PRs, metrics, risk events, and AI briefs.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <GhostBtn onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                Cancel
              </GhostBtn>
              <button
                onClick={confirmDeleteData}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-medium text-sm rounded-lg shadow-sm transition-all flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Purging Data...</span>
                  </>
                ) : (
                  <>
                    <span>🗑️ Yes, Purge Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}
    </PageShell>
  );
}
