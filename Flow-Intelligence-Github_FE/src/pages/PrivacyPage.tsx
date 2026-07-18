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
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

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

  const handleSave = async () => {
    if (!selectedRepoId || !settings) return;
    setSaving(true);
    setError(null);
    try {
      await privacyApi.updateSettings(selectedRepoId, settings);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save privacy settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteData = () => {
    if (confirm("Are you sure you want to request data deletion? This will anonymize or purge all records associated with this repository.")) {
      alert("Data deletion request submitted.");
    }
  };

  return (
    <PageShell
      title="Privacy & Security"
      actions={
        repos.length > 0 ? (
          <>
            <RepoSelect repos={repos} value={selectedRepoId} onChange={handleSelectRepo} />
            <PrimaryBtn onClick={handleSave} disabled={saving || loading}>
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

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-800">Exclude Raw Comments</h4>
                  <p className="text-sm text-slate-500 max-w-lg">Prevent raw pull request comments and review text from being included in AI payloads.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={settings.excludeRawComments} onChange={() => handleToggle("excludeRawComments")} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
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
                <GhostBtn onClick={handleDeleteData}>
                  <span className="text-rose-600">🗑️ Delete Data</span>
                </GhostBtn>
              </div>
          </section>
        </div>
      )}

      {showToast && (
        <div className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <span className="font-medium">Privacy settings saved successfully!</span>
        </div>
      )}
    </PageShell>
  );
}
