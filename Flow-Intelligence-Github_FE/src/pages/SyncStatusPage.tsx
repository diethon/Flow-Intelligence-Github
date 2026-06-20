import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSyncStatus, useSyncRuns, useSyncNow } from '../hooks/useSyncStatus';
import { useRepositoryDetails } from '../hooks/useRepositories';
import { SyncStatusCard } from '../components/SyncStatusCard';
import { SyncTimeline } from '../components/SyncTimeline';
import { RepositoryStatsCard } from '../components/RepositoryStatsCard';
import { WebhookStatusCard } from '../components/WebhookStatusCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import type { SyncStatus } from '../types';

interface SyncStatusPageProps {
  repositoryId: string;
}

type RunFilter = 'all' | 'completed' | 'failed' | 'running';
type RunSort = 'newest' | 'oldest';

export const SyncStatusPage: React.FC<SyncStatusPageProps> = ({ repositoryId }) => {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<RunFilter>('all');
  const [sort, setSort] = useState<RunSort>('newest');
  const limit = 5;
  const queryClient = useQueryClient();

  const syncStatusQuery = useSyncStatus(repositoryId);
  const syncRunsQuery = useSyncRuns(repositoryId, { page, limit });
  const syncNowMutation = useSyncNow();
  const detailsQuery = useRepositoryDetails(repositoryId);

  const handleSyncNow = async () => {
    try {
      await syncNowMutation.mutateAsync(repositoryId);
    } catch (error) {
      // handled by mutation state
    }
  };

  const handlePageChange = (newPage: number) => {
    queryClient.removeQueries({ queryKey: ['repositories', repositoryId, 'sync-runs'] });
    setPage(newPage);
  };

  const summary = syncStatusQuery.data?.data?.syncStatus as {
    status: string;
    lastSyncAt: string;
    pendingJobs: number;
    currentRun?: any;
  } | null;
  const runs = syncRunsQuery.data?.runs || [];
  const total = syncRunsQuery.data?.pagination?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Filter runs locally
  const filteredRuns = runs.filter((run: any) => {
    if (filter === 'all') return true;
    if (filter === 'running') return run.status === 'running' || run.status === 'pending';
    if (filter === 'completed') return run.status === 'success';
    return run.status === filter;
  });

  // Sort runs
  const sortedRuns = [...filteredRuns].sort((a, b) => {
    const aTime = new Date(a.startedAt).getTime();
    const bTime = new Date(b.startedAt).getTime();
    return sort === 'newest' ? bTime - aTime : aTime - bTime;
  });

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link to="/dashboard" className="hover:text-indigo-600 transition-colors">
              Dashboard
            </Link>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <Link to="/repositories/connect" className="hover:text-indigo-600 transition-colors">
              Connected Repos
            </Link>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-slate-900 font-medium">Sync Status</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Repository Sync Status</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncNow}
            disabled={syncNowMutation.isPending}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
          >
            {syncNowMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Now
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading & Error States */}
      {syncStatusQuery.isLoading && <LoadingSpinner label="Loading sync status..." />}

      {syncStatusQuery.isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700">
              {syncStatusQuery.error instanceof Error ? syncStatusQuery.error.message : 'Failed to load sync status'}
            </p>
          </div>
        </div>
      )}

      {/* Repository Statistics */}
      {(detailsQuery.data?.data || detailsQuery.isError) && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Repository Statistics
            </h2>
            {detailsQuery.isFetching && (
              <span className="flex items-center gap-2 text-xs text-slate-400">
                <div className="w-3 h-3 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
                Updating...
              </span>
            )}
          </div>
          {detailsQuery.isLoading ? (
            <LoadingSpinner label="Loading repository details..." />
          ) : detailsQuery.isError ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-red-500 text-sm mb-2">Failed to load repository details</p>
              <p className="text-slate-400 text-xs">{String(detailsQuery.error)}</p>
            </div>
          ) : detailsQuery.data?.data ? (
            <RepositoryStatsCard details={detailsQuery.data.data} />
          ) : null}
        </div>
      )}

      {/* Status Cards Grid */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <SyncStatusCard
            status={summary.status as SyncStatus}
            lastSyncAt={summary.lastSyncAt}
            pendingJobs={summary.pendingJobs}
            currentRun={summary.currentRun || null}
          />
          <WebhookStatusCard
            lastEventReceivedAt={summary.lastSyncAt}
            lastEventType="Sync"
            unprocessedCount={summary.pendingJobs}
          />
          {/* Quick Actions Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick Actions
            </h3>
            <div className="space-y-3">
              <Link
                to={`/repositories/${repositoryId}/pull-requests`}
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-indigo-300 transition-all"
              >
                <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">View Pull Requests</p>
                  <p className="text-xs text-slate-500">Review synced PRs</p>
                </div>
                <svg className="w-4 h-4 text-slate-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <button
                onClick={handleSyncNow}
                disabled={syncNowMutation.isPending}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-green-300 transition-all disabled:opacity-50"
              >
                <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-900">Trigger Sync</p>
                  <p className="text-xs text-slate-500">Manual sync from GitHub</p>
                </div>
                <svg className="w-4 h-4 text-slate-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync History Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Sync History
            <span className="ml-2 px-2.5 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-700 rounded-full">
              {total}
            </span>
          </h2>

          {/* Filter & Sort Controls */}
          <div className="flex items-center gap-3">
            <select
              value={filter}
              onChange={(e) => { setFilter(e.target.value as RunFilter); setPage(1); }}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-colors cursor-pointer"
            >
              <option value="all">All Runs</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as RunSort)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-colors cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-slate-500 mb-4">
          Showing <span className="font-medium text-slate-700">{sortedRuns.length}</span> of{' '}
          <span className="font-medium text-slate-700">{total}</span> runs
          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="ml-2 text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Clear filter
            </button>
          )}
        </p>

        {syncRunsQuery.isLoading && <LoadingSpinner label="Loading runs..." />}

        {syncRunsQuery.isError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-700 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {syncRunsQuery.error instanceof Error ? syncRunsQuery.error.message : 'Failed to load runs'}
            </p>
          </div>
        )}

        {sortedRuns.length > 0 ? (
          <>
            <SyncTimeline runs={sortedRuns} />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  onClick={() => handlePageChange(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-10 h-10 text-sm font-medium rounded-lg transition-colors ${
                          page === pageNum
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-600 font-medium">No sync runs found</p>
            <p className="text-sm text-slate-400 mt-1">
              {filter !== 'all' ? 'Try adjusting your filter' : 'Run a sync to see history'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncStatusPage;
