import React, { useState, useEffect, useCallback } from 'react';
import {
  adminGetStats,
  adminGetRepositories,
  adminForceSyncRepository,
  adminDisconnectRepository
} from '../services/adminService';
import type { SystemStats, AdminRepository } from '../services/adminService';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

export const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [repositories, setRepositories] = useState<AdminRepository[]>([]);
  const [totalRepos, setTotalRepos] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Repository actions state
  const [repoToDisconnect, setRepoToDisconnect] = useState<AdminRepository | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const response = await adminGetStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (err: any) {
      console.error('Failed to load system stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchRepositories = useCallback(async () => {
    setLoadingRepos(true);
    setError(null);
    try {
      const response = await adminGetRepositories({ page, limit });
      if (response.success && response.data) {
        setRepositories(response.data.repositories);
        setTotalRepos(response.data.total);
      } else {
        setError(response.message || 'Failed to load repositories');
      }
    } catch (err: any) {
      console.error('Failed to load repositories:', err);
      setError(err?.response?.data?.message || 'Error occurred while loading repositories');
    } finally {
      setLoadingRepos(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchStats();
    fetchRepositories();
  }, [fetchStats, fetchRepositories]);

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleForceSync = async (repo: AdminRepository) => {
    try {
      const response = await adminForceSyncRepository(repo._id);
      if (response.success) {
        triggerSuccess(`Sync job enqueued successfully for ${repo.fullName}`);
        fetchStats(); // update queue counts
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to trigger sync job');
    }
  };

  const handleDisconnectConfirm = async () => {
    if (!repoToDisconnect) return;
    setActionLoading(true);
    setError(null);
    try {
      const response = await adminDisconnectRepository(repoToDisconnect._id);
      if (response.success) {
        setRepositories(repositories.filter(r => r._id !== repoToDisconnect._id));
        setTotalRepos(prev => prev - 1);
        setRepoToDisconnect(null);
        triggerSuccess(`Repository ${repoToDisconnect.fullName} disconnected successfully`);
        fetchStats();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to disconnect repository');
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.ceil(totalRepos / limit);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Alert Messages */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center justify-between text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800 font-bold">×</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-xl flex items-center justify-between text-sm shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800 font-bold">×</button>
        </div>
      )}

      {/* Main Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Overview</h1>
          <p className="text-sm text-slate-500 mt-1">Global statistics, data quality monitoring, and repository connection queues.</p>
        </div>
        <div>
          <button
            onClick={() => {
              fetchStats();
              fetchRepositories();
              triggerSuccess('System statistics refreshed');
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-350 text-slate-700 active:bg-slate-100 transition-all shadow-sm"
          >
            ↻ Refresh Stats
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Active Users</p>
          {loadingStats ? (
            <div className="h-8 w-20 bg-slate-100 animate-pulse rounded mt-2" />
          ) : (
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{stats?.totalUsers ?? 0}</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Connected Repositories</p>
          {loadingStats ? (
            <div className="h-8 w-20 bg-slate-100 animate-pulse rounded mt-2" />
          ) : (
            <p className="text-3xl font-extrabold text-indigo-600 mt-2">{stats?.totalRepos ?? 0}</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Synced Commits</p>
          {loadingStats ? (
            <div className="h-8 w-20 bg-slate-100 animate-pulse rounded mt-2" />
          ) : (
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{stats?.totalCommits ?? 0}</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Synced Pull Requests</p>
          {loadingStats ? (
            <div className="h-8 w-20 bg-slate-100 animate-pulse rounded mt-2" />
          ) : (
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{stats?.totalPRs ?? 0}</p>
          )}
        </div>
      </div>

      {/* Sync Jobs Status Area */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: Info and KPIs */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Background Sync Queue Status</h2>
              <p className="text-xs text-slate-400 mt-0.5">Real-time status of cron tasks and data import jobs across all repositories.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending</p>
                  <p className="text-2xl font-extrabold text-slate-700 mt-1">{stats?.syncStats.pending ?? 0}</p>
                </div>
                <span className="text-xl">⏳</span>
              </div>

              <div className="bg-indigo-50/30 border border-indigo-100 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Processing</p>
                  <p className="text-2xl font-extrabold text-indigo-600 mt-1">{stats?.syncStats.running ?? 0}</p>
                </div>
                <span className="text-xl animate-spin inline-block">⚙️</span>
              </div>

              <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Completed</p>
                  <p className="text-2xl font-extrabold text-emerald-600 mt-1">{stats?.syncStats.completed ?? 0}</p>
                </div>
                <span className="text-xl">✅</span>
              </div>

              <div className="bg-rose-50/30 border border-rose-100 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Failed Jobs</p>
                  <p className="text-2xl font-extrabold text-rose-600 mt-1">{stats?.syncStats.failed ?? 0}</p>
                </div>
                <span className="text-xl">❌</span>
              </div>
            </div>
          </div>

          {/* Right panel: Donut Chart */}
          <div className="flex flex-col items-center justify-center border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 self-start lg:self-center">Queue Distribution</p>
            {stats && (stats.syncStats.pending > 0 || stats.syncStats.running > 0 || stats.syncStats.completed > 0 || stats.syncStats.failed > 0) ? (
              <div className="w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Pending', value: stats.syncStats.pending, color: '#94a3b8' },
                        { name: 'Processing', value: stats.syncStats.running, color: '#6366f1' },
                        { name: 'Completed', value: stats.syncStats.completed, color: '#10b981' },
                        { name: 'Failed', value: stats.syncStats.failed, color: '#f43f5e' }
                      ].filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={38}
                      outerRadius={55}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {[
                        { name: 'Pending', value: stats.syncStats.pending, color: '#94a3b8' },
                        { name: 'Processing', value: stats.syncStats.running, color: '#6366f1' },
                        { name: 'Completed', value: stats.syncStats.completed, color: '#10b981' },
                        { name: 'Failed', value: stats.syncStats.failed, color: '#f43f5e' }
                      ].filter(d => d.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: '500' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[140px] flex items-center justify-center text-xs text-slate-400 font-medium">
                No active sync jobs
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Repositories Management */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-900">Active Repositories</h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage and inspect repository sync health, force database rebuilds, or disconnect connections.</p>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Repository</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Last Synced</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loadingRepos && repositories.length === 0 ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4">
                        <div className="h-4 w-44 bg-slate-100 rounded" />
                        <div className="h-3 w-32 bg-slate-100 rounded mt-1.5" />
                      </td>
                      <td className="px-6 py-4"><div className="h-5 w-14 bg-slate-100 rounded" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-28 bg-slate-100 rounded" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-8 w-24 bg-slate-100 rounded ml-auto" /></td>
                    </tr>
                  ))
                ) : repositories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 bg-slate-50/50">
                      <span className="text-3xl">🔌</span>
                      <h3 className="text-sm font-semibold text-slate-800 mt-2">No connected repositories</h3>
                      <p className="text-xs text-slate-400 mt-1">Repositories will appear here once users connect them.</p>
                    </td>
                  </tr>
                ) : (
                  repositories.map((repo) => (
                    <tr key={repo._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{repo.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Owner: {repo.owner}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border
                          ${repo.isPrivate 
                            ? 'bg-slate-100 border-slate-200 text-slate-600' 
                            : 'bg-green-50 border-green-200 text-green-700'
                          }`}
                        >
                          {repo.isPrivate ? 'Private' : 'Public'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {repo.lastSyncedAt ? new Date(repo.lastSyncedAt).toLocaleString('en-GB') : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleForceSync(repo)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-350 active:bg-slate-100 transition-all rounded-lg shadow-sm"
                          >
                            <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Force Sync
                          </button>
                          <button
                            onClick={() => setRepoToDisconnect(repo)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold bg-rose-50/30 border border-rose-200/60 text-rose-600 hover:bg-rose-50 hover:border-rose-300 active:bg-rose-100 transition-all rounded-lg shadow-sm"
                          >
                            <svg className="h-3.5 w-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Disconnect
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Showing page <strong className="font-semibold text-slate-700">{page}</strong> of <strong className="font-semibold text-slate-700">{totalPages}</strong>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-350 text-slate-700 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1.5"
                >
                  <svg className="h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-350 text-slate-700 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1.5"
                >
                  Next
                  <svg className="h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Disconnect Modal */}
      {repoToDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white max-w-md w-full rounded-2xl border border-slate-200 shadow-2xl p-6 relative animate-scaleUp">
            <h3 className="text-lg font-bold text-slate-900">Disconnect Repository</h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Are you sure you want to disconnect repository <strong className="text-slate-800">{repoToDisconnect.fullName}</strong>?
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl mt-3 flex gap-2">
              <span className="text-sm">⚠️</span>
              <div>
                <p className="font-bold">Important Notice</p>
                <p className="mt-0.5">This will delete all metrics, synced commits, review requests, and role permissions of this repository from our database.</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setRepoToDisconnect(null)}
                disabled={actionLoading}
                className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnectConfirm}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 text-white text-sm font-semibold rounded-xl hover:bg-rose-500 active:bg-rose-700 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-md shadow-rose-600/10"
              >
                {actionLoading ? (
                  <>
                    <span className="animate-spin inline-block rounded-full h-3.5 w-3.5 border-2 border-transparent border-t-white" />
                    Disconnecting...
                  </>
                ) : (
                  'Confirm Disconnect'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
