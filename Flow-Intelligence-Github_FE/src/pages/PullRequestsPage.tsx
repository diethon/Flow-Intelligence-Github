import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { getPullRequests } from '../services/repositoryService';

interface PullRequest {
  id: string;
  number: number;
  title: string;
  state: string;
  author: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  url: string;
  additions?: number;
  deletions?: number;
  reviewStatus: string;
}

const stateConfig: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  open: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  closed: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  merged: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
};

const reviewStatusConfig: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  approved: { bg: 'bg-green-100 text-green-700', text: 'text-green-700', icon: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )},
  changes_requested: { bg: 'bg-red-100 text-red-700', text: 'text-red-700', icon: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )},
  pending: { bg: 'bg-slate-100 text-slate-700', text: 'text-slate-700', icon: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )},
};

const StatCard: React.FC<{
  label: string;
  value: number;
  color: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, value, color, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 p-4 rounded-xl border-2 transition-all ${
      isActive
        ? `${color} border-current shadow-sm`
        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
    }`}
  >
    <p className={`text-sm ${isActive ? '' : 'text-slate-500'}`}>{label}</p>
    <p className={`mt-1 text-2xl font-bold ${isActive ? '' : 'text-slate-900'}`}>{value}</p>
  </button>
);

export const PullRequestsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [allPullRequests, setAllPullRequests] = useState<PullRequest[]>([]);
  const [filteredPullRequests, setFilteredPullRequests] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchAllPullRequests();
  }, [id]);

  useEffect(() => {
    applyFilter();
  }, [filter, allPullRequests]);

  const fetchAllPullRequests = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await getPullRequests(id, {});
      if (response.success && response.data) {
        setAllPullRequests(response.data.pullRequests || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pull requests');
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    if (filter === 'all') {
      setFilteredPullRequests(allPullRequests);
    } else {
      setFilteredPullRequests(allPullRequests.filter((pr) => pr.state === filter));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const stats = {
    total: allPullRequests.length,
    open: allPullRequests.filter((pr) => pr.state === 'open').length,
    merged: allPullRequests.filter((pr) => pr.state === 'merged').length,
    closed: allPullRequests.filter((pr) => pr.state === 'closed').length,
  };

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
            <Link to={`/repositories/${id}/sync-status`} className="hover:text-indigo-600 transition-colors">
              Sync Status
            </Link>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-slate-900 font-medium">Pull Requests</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <svg className="w-7 h-7 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Pull Requests
          </h1>
        </div>
        <button
          onClick={fetchAllPullRequests}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm hover:shadow"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Total" value={stats.total} color="bg-indigo-50 border-indigo-200" isActive={filter === 'all'} onClick={() => setFilter('all')} />
        <StatCard label="Open" value={stats.open} color="bg-emerald-50 border-emerald-200" isActive={filter === 'open'} onClick={() => setFilter('open')} />
        <StatCard label="Merged" value={stats.merged} color="bg-purple-50 border-purple-200" isActive={filter === 'merged'} onClick={() => setFilter('merged')} />
        <StatCard label="Closed" value={stats.closed} color="bg-red-50 border-red-200" isActive={filter === 'closed'} onClick={() => setFilter('closed')} />
      </div>

      {loading && <LoadingSpinner label="Loading pull requests..." />}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && filteredPullRequests.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-slate-600 font-medium">No pull requests found</p>
          <p className="text-sm text-slate-400 mt-1">
            {filter !== 'all' ? 'Try selecting a different filter' : 'Pull requests will appear here after syncing with GitHub'}
          </p>
          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="mt-4 px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Show all pull requests
            </button>
          )}
        </div>
      )}

      {!loading && !error && filteredPullRequests.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Showing <span className="font-semibold text-slate-900">{filteredPullRequests.length}</span> of{' '}
              <span className="font-semibold text-slate-900">{stats.total}</span> pull requests
            </p>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Sorted by newest
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredPullRequests.map((pr) => {
              const state = stateConfig[pr.state] || stateConfig.open;
              const review = reviewStatusConfig[pr.reviewStatus] || reviewStatusConfig.pending;

              return (
                <div
                  key={pr.id}
                  className="p-5 hover:bg-slate-50/50 transition-colors group"
                >
                  <div className="flex items-start gap-4">
                    {/* State Icon */}
                    <div className={`mt-1 h-10 w-10 rounded-xl ${state.bg} border ${state.border} flex items-center justify-center flex-shrink-0 ${state.text}`}>
                      {state.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              #{pr.number}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${state.bg} ${state.text}`}>
                              {pr.state}
                            </span>
                          </div>
                          <a
                            href={pr.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base font-semibold text-slate-900 hover:text-indigo-600 line-clamp-1 transition-colors"
                          >
                            {pr.title}
                          </a>
                          <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                            <span className="flex items-center gap-1.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {pr.author}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {formatDate(pr.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Review Status Badge */}
                        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${review.bg} flex-shrink-0`}>
                          {review.icon}
                          <span className="capitalize">{pr.reviewStatus.replace('_', ' ')}</span>
                        </div>
                      </div>

                      {/* Labels & Changes */}
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex flex-wrap gap-2">
                          {pr.labels?.slice(0, 5).map((label) => (
                            <span
                              key={label}
                              className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                            >
                              {label}
                            </span>
                          ))}
                          {pr.labels?.length > 5 && (
                            <span className="text-xs text-slate-400 px-2 py-1">
                              +{pr.labels.length - 5}
                            </span>
                          )}
                        </div>

                        {pr.additions !== undefined && (
                          <div className="flex items-center gap-3 text-sm font-mono">
                            <span className="flex items-center gap-1 text-green-600">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              {pr.additions}
                            </span>
                            <span className="flex items-center gap-1 text-red-600">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                              </svg>
                              {pr.deletions || 0}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* External Link */}
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PullRequestsPage;
