import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectRepository, useRepositories } from '../hooks/useRepositories';
import { useQueryClient } from '@tanstack/react-query';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { triggerSync, getSuggestedRepositories } from '../services/githubService';

interface SuggestedRepo {
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
}

export const ConnectRepositoryPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const connectMutation = useConnectRepository();
  const repositoriesQuery = useRepositories();
  const [formData, setFormData] = useState({ owner: '', repo: '' });
  const [error, setError] = useState<string | null>(null);
  const [suggestedRepos, setSuggestedRepos] = useState<SuggestedRepo[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    setLoadingSuggestions(true);
    setSuggestionsError(null);
    try {
      const data = await getSuggestedRepositories();
      setSuggestedRepos(data.repositories || []);
    } catch (err: any) {
      console.error('Failed to load suggestions:', err);
      setSuggestionsError(err?.message || 'Failed to load repositories');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSelectSuggestion = (repo: SuggestedRepo) => {
    const [owner, name] = repo.full_name.split('/');
    setFormData({ owner, repo: name });
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowSuggestions(false);
    try {
      const result = await connectMutation.mutateAsync({ owner: formData.owner, repo: formData.repo });
      setFormData({ owner: '', repo: '' });

      await queryClient.invalidateQueries({ queryKey: ['repositories'] });

      if (result?.data?.repository?.id) {
        const repoId = result.data.repository.id;
        await triggerSync(repoId);
        navigate(`/repositories/${repoId}/sync-status`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const repositories = repositoriesQuery.data?.data || [];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-slate-500">Connect and manage your GitHub repositories</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Connected Repositories</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{repositories.length}</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center">
              <svg className="h-6 w-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Last Sync</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {repositories[0]?.lastSyncedAt
                  ? new Date(repositories[0].lastSyncedAt).toLocaleDateString()
                  : 'Never'}
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center">
              <svg className="h-6 w-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Webhook Status</p>
              <p className="mt-2 text-lg font-semibold text-slate-700">Healthy</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full bg-slate-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Connect Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <svg className="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Connect Repository</h2>
            <p className="text-sm text-slate-500">Add a new GitHub repository to sync</p>
          </div>
        </div>

        {connectMutation.isPending && <LoadingSpinner label="Connecting..." />}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4">
            <div className="flex items-center gap-2 text-red-700">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {connectMutation.isSuccess && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-center gap-2 text-green-700">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-medium">Repository connected successfully!</p>
            </div>
          </div>
        )}

        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Browse your GitHub repositories
            </button>
            <span className="text-slate-300">|</span>
            <span className="text-sm text-slate-400">or enter manually below</span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Owner</label>
              <input
                type="text"
                name="owner"
                required
                value={formData.owner}
                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20 outline-none transition-all"
                placeholder="owner-name"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Repository</label>
              <input
                type="text"
                name="repo"
                required
                value={formData.repo}
                onChange={(e) => setFormData({ ...formData, repo: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20 outline-none transition-all"
                placeholder="repo-name"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={connectMutation.isPending}
                className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-black text-white font-medium text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {connectMutation.isPending ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </form>

          {/* Suggestions Panel */}
          {showSuggestions && (
            <div className="mt-4 border border-slate-200 rounded-lg bg-slate-50">
              <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-white rounded-t-lg">
                <span className="text-sm font-medium text-slate-700">Your GitHub Repositories</span>
                <div className="flex items-center gap-2">
                  {loadingSuggestions && <span className="text-xs text-slate-400">Loading...</span>}
                  {!loadingSuggestions && <span className="text-xs text-slate-400">{suggestedRepos.length} repos</span>}
                  <button onClick={() => setShowSuggestions(false)} className="text-slate-400 hover:text-slate-600">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              {loadingSuggestions ? (
                <div className="p-8 text-center text-slate-500">Loading repositories...</div>
              ) : suggestedRepos.length > 0 ? (
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-200 bg-white rounded-b-lg">
                  {suggestedRepos.map((repo) => (
                    <button
                      key={repo.full_name}
                      onClick={() => handleSelectSuggestion(repo)}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">{repo.full_name}</p>
                          {repo.description && (
                            <p className="text-xs text-slate-500 truncate">{repo.description}</p>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${repo.private ? 'bg-slate-200 text-slate-600' : 'bg-green-100 text-green-700'}`}>
                          {repo.private ? 'Private' : 'Public'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : suggestionsError ? (
                <div className="p-6 text-center bg-white rounded-b-lg">
                  <p className="text-red-500 text-sm mb-2">{suggestionsError}</p>
                  <button
                    onClick={loadSuggestions}
                    className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 bg-white rounded-b-lg">
                  No repositories found. Make sure your GitHub token has the required permissions.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Repositories List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Connected Repositories</h2>
        </div>

        {repositoriesQuery.isLoading && (
          <div className="p-8">
            <LoadingSpinner label="Loading repositories..." />
          </div>
        )}

        {repositories.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {repositories.map((repo) => (
              <div key={repo.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                      <svg className="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{repo.fullName}</p>
                      <p className="text-sm text-slate-500">
                        {repo.isPrivate ? 'Private' : 'Public'} - Last synced: {repo.lastSyncedAt ? new Date(repo.lastSyncedAt).toLocaleString() : 'Never'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/repositories/${repo.id}/sync-status`)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    View Status
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          !repositoriesQuery.isLoading && (
            <div className="p-12 text-center">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              </div>
              <p className="text-slate-500">No repositories connected yet</p>
              <p className="text-sm text-slate-400 mt-1">Select a repository from your GitHub account above</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default ConnectRepositoryPage;
