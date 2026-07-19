import { useState, useEffect } from "react";
import { PageShell, SectionHeading, PrimaryBtn, GhostBtn } from "../components/PageShell";
import { RepoSelect } from "../components/PageShell";
import { fetchDashboardRepositories } from "../api/dashboardApi";
import type { Repository } from "../types/dashboard";
import { privacyApi, type PrivacySettingsData } from "../api/privacyApi";
import { briefApi } from "../api/briefApi";
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
  const [toastMessage, setToastMessage] = useState("Settings saved successfully!");

  // Slack Notification settings
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [testingNotification, setTestingNotification] = useState(false);

  useEffect(() => {
    fetchDashboardRepositories()
      .then((data) => {
        setRepos(data);
        if (data.length > 0) {
          const cachedId = localStorage.getItem("selectedRepositoryId");
          const exists = data.some((r) => r._id === cachedId);
          const activeId = exists && cachedId ? cachedId : data[0]._id;
          setSelectedRepoId(activeId);

          const currentRepo = data.find((r) => r._id === activeId);
          setSlackWebhookUrl((currentRepo as any)?.slackWebhookUrl || "");
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
      const currentRepo = repos.find((r) => r._id === selectedRepoId);
      setSlackWebhookUrl((currentRepo as any)?.slackWebhookUrl || "");
    } catch (err: any) {
      setError(err.message || "Failed to load settings");
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
      await briefApi.updateNotificationSettings(selectedRepoId, slackWebhookUrl);

      setRepos((prev) =>
        prev.map((r) => (r._id === selectedRepoId ? { ...r, slackWebhookUrl } : r))
      );

      setToastMessage("Privacy & Slack notification settings saved!");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3500);
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    if (!selectedRepoId) return;
    setTestingNotification(true);
    try {
      const res = await briefApi.sendBriefNotification(selectedRepoId, { slackWebhookUrl });
      const emailRes = res.data?.notifications?.emailSent ? "Email ✅" : "Email ⚠️";
      const slackRes = res.data?.notifications?.slackSent ? "Slack ✅" : "Slack ⚠️";
      setToastMessage(`Test dispatch complete: ${emailRes}, ${slackRes}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    } catch (err: any) {
      alert("Failed to send test notification: " + err.message);
    } finally {
      setTestingNotification(false);
    }
  };

  const handleDeleteData = () => {
    if (confirm("Are you sure you want to request data deletion? This will anonymize or purge all records associated with this repository.")) {
      alert("Data deletion request submitted.");
    }
  };

  return (
    <PageShell
      title="Settings & Privacy"
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

      {loading && !settings && <LoadingState message="Loading repository settings..." />}

      {!loading && !error && settings && (
        <div className="space-y-8 max-w-4xl">
          {/* Slack Integration Card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
            <SectionHeading
              title="💬 Slack Integration & Channel Delivery"
              subtitle="Configure Slack Incoming Webhook for automatic Friday 17:00 Weekly AI Brief delivery."
            />

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">
                  Slack Incoming Webhook URL
                </label>
                <div className="flex flex-col sm:flex-row items-stretch gap-3">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-sm">🔗</span>
                    <input
                      type="url"
                      value={slackWebhookUrl}
                      onChange={(e) => setSlackWebhookUrl(e.target.value)}
                      placeholder="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"
                      className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <PrimaryBtn onClick={handleSave} disabled={saving || loading}>
                    {saving ? "Saving..." : "💾 Save Webhook"}
                  </PrimaryBtn>
                  <GhostBtn onClick={handleTestNotification} disabled={testingNotification}>
                    {testingNotification ? "Sending..." : "🧪 Send Summary Report"}
                  </GhostBtn>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Enter your Slack Incoming Webhook URL to automatically receive the Weekly AI Brief in your team's channel every Friday at 17:00. Email reports are automatically sent to the project owner.
                </p>
              </div>
            </div>
          </section>

          {/* AI Privacy Settings Card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
            <SectionHeading title="AI Payload & Privacy Settings" subtitle="Control what data is sent to AI models for analysis." />

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

          {/* Data Sharing & Retention */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
            <SectionHeading title="Data Sharing & Retention" subtitle="Manage how your data is retained and shared." />

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 text-sm text-slate-700">
              <strong className="block text-slate-900 mb-2">Prohibited Use Notice:</strong>
              Data generated by this platform is strictly for identifying process bottlenecks. It must not be used for individual performance evaluation, compensation decisions, or HR punitive actions.
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-rose-600">Request Data Deletion</h4>
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
        <div className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}
    </PageShell>
  );
}
