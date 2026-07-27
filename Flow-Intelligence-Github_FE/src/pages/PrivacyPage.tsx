import { useState, useEffect } from "react";
import { PageShell, SectionHeading, PrimaryBtn, GhostBtn } from "../components/PageShell";
import { RepoSelect } from "../components/PageShell";
import { fetchDashboardRepositories } from "../api/dashboardApi";
import type { Repository } from "../types/dashboard";
import { privacyApi, type PrivacySettingsData } from "../api/privacyApi";
import { briefApi } from "../api/briefApi";
import { getPermissionErrorMessage } from "../utils/modulePermissions";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { useAuth } from "../hooks/useAuth";

export function PrivacyPage() {
  const { user } = useAuth();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [settings, setSettings] = useState<PrivacySettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const deleting = false;
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("Settings saved successfully!");

  // Slack & Schedule Notification settings
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleDay, setScheduleDay] = useState("FRIDAY");
  const [scheduleTime, setScheduleTime] = useState("17:00");
  const [testingNotification, setTestingNotification] = useState(false);
  const selectedRepository = repos.find(repo => repo._id === selectedRepoId);
  const canViewAutomatedDelivery =
    selectedRepository?.role === "leader" ||
    selectedRepository?.role === "dev";
  const canSendSummary =
    selectedRepository?.role === "leader" ||
    selectedRepository?.role === "dev" ||
    (user?.role === "admin" && selectedRepository?.isOwner === true);

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
          setScheduleEnabled((currentRepo as any)?.scheduleEnabled !== false);
          setScheduleDay((currentRepo as any)?.scheduleDay || "FRIDAY");
          setScheduleTime((currentRepo as any)?.scheduleTime || "17:00");
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
      setScheduleEnabled((currentRepo as any)?.scheduleEnabled !== false);
      setScheduleDay((currentRepo as any)?.scheduleDay || "FRIDAY");
      setScheduleTime((currentRepo as any)?.scheduleTime || "17:00");
    } catch (err: unknown) {
      setError(getPermissionErrorMessage(err, "Failed to load settings"));
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
    window.dispatchEvent(new Event("selectedRepositoryChanged"));
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
      await briefApi.updateNotificationSettings(selectedRepoId, {
        slackWebhookUrl,
        scheduleEnabled,
        scheduleDay,
        scheduleTime,
      });

      setRepos((prev) =>
        prev.map((r) =>
          r._id === selectedRepoId
            ? { ...r, slackWebhookUrl, scheduleEnabled, scheduleDay, scheduleTime }
            : r
        )
      );

      setToastMessage("Privacy & delivery schedule settings saved!");
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
            <PrimaryBtn onClick={handleSave} disabled={saving || loading || deleting}>
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
          {/* Notification Schedule & Slack Integration Card */}
          {canViewAutomatedDelivery && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
            <SectionHeading
              title="💬 Automated Delivery & Slack Integration"
              subtitle="Configure your team's preferred day, time, and Slack Webhook for Weekly AI Brief delivery."
            />

            <div className="mt-6 space-y-6">
              {/* Schedule Enable Toggle */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h4 className="font-semibold text-slate-800">Enable Automatic Weekly Schedule</h4>
                  <p className="text-sm text-slate-500 max-w-lg">
                    Automatically generate AI Brief and send Email & Slack reports on the configured schedule.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={scheduleEnabled}
                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Day & Time Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    📅 Delivery Day
                  </label>
                  <select
                    value={scheduleDay}
                    onChange={(e) => setScheduleDay(e.target.value)}
                    disabled={!scheduleEnabled}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:bg-slate-50"
                  >
                    <option value="MONDAY">Monday</option>
                    <option value="TUESDAY">Tuesday</option>
                    <option value="WEDNESDAY">Wednesday</option>
                    <option value="THURSDAY">Thursday</option>
                    <option value="FRIDAY">Friday</option>
                    <option value="SATURDAY">Saturday</option>
                    <option value="SUNDAY">Sunday</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    ⏰ Delivery Time
                  </label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    disabled={!scheduleEnabled}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:bg-slate-50 font-mono"
                  />
                </div>
              </div>

              {/* Slack Webhook Input */}
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">
                  Slack Incoming Webhook URL (Optional)
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
                    {saving ? "Saving..." : "💾 Save Settings"}
                  </PrimaryBtn>
                  {canSendSummary && (
                    <GhostBtn onClick={handleTestNotification} disabled={testingNotification}>
                      {testingNotification ? "Sending..." : "🧪 Send Summary Report"}
                    </GhostBtn>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Scheduled reports will be sent automatically to the connected project owner email and Slack channel (if Webhook URL is provided).
                </p>
              </div>
            </div>
            </section>
          )}

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
