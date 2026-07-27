import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  useConnectRepository,
  useRepositories,
  useDisconnectRepository,
} from "../hooks/useRepositories";
import { useQueryClient } from "@tanstack/react-query";
import { LoadingSpinner } from "../components/LoadingSpinner";
import {
  triggerSync,
  getSuggestedRepositories,
} from "../services/githubService";

interface SuggestedRepo {
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
}

type SortField = "fullName" | "lastSyncedAt" | "createdAt";
type SortOrder = "asc" | "desc";
type FilterType = "all" | "private" | "public";

const ITEMS_PER_PAGE = 10;

export const ConnectRepositoryPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const connectMutation = useConnectRepository();
  const repositoriesQuery = useRepositories();
  const disconnectMutation = useDisconnectRepository();

  const formatErrorMessage = (errorStr: string | null): string => {
    if (!errorStr) return "";
    try {
      const parsed = JSON.parse(errorStr);
      if (parsed && typeof parsed === "object") {
        const msg = parsed.message || "Connection failed";
        if (msg.includes("not found") || parsed.status === 404) {
          return "Không tìm thấy repository trên GitHub. Vui lòng kiểm tra lại Owner và Tên Repo.";
        }
        if (parsed.status === 401) {
          return "Phiên xác thực GitHub đã hết hạn. Vui lòng đăng nhập lại.";
        }
        return msg;
      }
    } catch (e) {
      // Use raw string
    }
    return errorStr;
  };

  // Connect form state
  const [formData, setFormData] = useState({ owner: "", repo: "" });
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestedRepos, setSuggestedRepos] = useState<SuggestedRepo[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  // Dashboard filters, search & pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortField, setSortField] = useState<SortField>("lastSyncedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);

  // Disconnect state
  const [disconnectRepo, setDisconnectRepo] = useState<{
    id: string;
    fullName: string;
  } | null>(null);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const loadSuggestions = async () => {
    setLoadingSuggestions(true);
    setSuggestionsError(null);
    try {
      const data = await getSuggestedRepositories();
      setSuggestedRepos(data.repositories || []);
    } catch (err: any) {
      console.error("Failed to load suggestions:", err);
      setSuggestionsError(err?.message || "Failed to load repositories");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSelectSuggestion = (repo: SuggestedRepo) => {
    const [owner, name] = repo.full_name.split("/");
    setFormData({ owner, repo: name });
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowSuggestions(false);
    try {
      const result = await connectMutation.mutateAsync({
        owner: formData.owner,
        repo: formData.repo,
      });
      setFormData({ owner: "", repo: "" });
      await queryClient.invalidateQueries({ queryKey: ["repositories"] });

      if (result?.data?.repository?.id) {
        const repoId = result.data.repository.id;
        await triggerSync(repoId);
        localStorage.setItem("selectedRepositoryId", repoId);
        window.dispatchEvent(new Event("repoChanged"));
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    }
  };

  const handleDisconnect = (repo: { id: string; fullName: string }) => {
    setDisconnectRepo(repo);
    setDisconnectError(null);
  };

  const handleConfirmDisconnect = async () => {
    if (!disconnectRepo) return;
    setDisconnectError(null);
    try {
      await disconnectMutation.mutateAsync(disconnectRepo.id);
      await queryClient.invalidateQueries({ queryKey: ["repositories"] });
      setDisconnectRepo(null);
    } catch (err) {
      setDisconnectError(
        err instanceof Error ? err.message : "Disconnect failed",
      );
    }
  };

  // Filter, sort, and paginate repositories
  const filteredAndSortedRepos = useMemo(() => {
    const repos = repositoriesQuery.data?.data || [];

    // Filter
    let filtered = repos.filter((repo) => {
      const matchesSearch = repo.fullName
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesFilter =
        filterType === "all"
          ? true
          : filterType === "private"
            ? repo.isPrivate
            : !repo.isPrivate;
      return matchesSearch && matchesFilter;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "fullName":
          comparison = a.fullName.localeCompare(b.fullName);
          break;
        case "lastSyncedAt":
          const aTime = a.lastSyncedAt ? new Date(a.lastSyncedAt).getTime() : 0;
          const bTime = b.lastSyncedAt ? new Date(b.lastSyncedAt).getTime() : 0;
          comparison = aTime - bTime;
          break;
        case "createdAt":
          comparison =
            (a.createdAt ? new Date(a.createdAt).getTime() : 0) -
            (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [
    repositoriesQuery.data?.data,
    searchQuery,
    filterType,
    sortField,
    sortOrder,
  ]);

  const totalPages = Math.ceil(filteredAndSortedRepos.length / ITEMS_PER_PAGE);
  const paginatedRepos = filteredAndSortedRepos.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, sortField, sortOrder]);

  const repositories = repositoriesQuery.data?.data || [];

  // Stats
  const totalRepos = repositories.length;
  const privateRepos = repositories.filter((r) => r.isPrivate).length;
  const publicRepos = totalRepos - privateRepos;
  const lastSyncRepo = repositories.find((r) => r.lastSyncedAt);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Repositories</h1>
        <p className="mt-1 text-slate-500">
          Connect and manage your GitHub repositories
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Total Repositories
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {totalRepos}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <svg
                className="h-5 w-5 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Private</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {privateRepos}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <svg
                className="h-5 w-5 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Public</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {publicRepos}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <svg
                className="h-5 w-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Last Sync</p>
              <p className="mt-2 text-lg font-semibold text-slate-900 truncate">
                {lastSyncRepo?.lastSyncedAt
                  ? new Date(lastSyncRepo.lastSyncedAt).toLocaleDateString()
                  : "Never"}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <svg
                className="h-5 w-5 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Connect Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <svg
              className="h-5 w-5 text-slate-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Connect Repository
            </h2>
            <p className="text-sm text-slate-500">
              Add a new GitHub repository to sync
            </p>
          </div>
        </div>

        {connectMutation.isPending && <LoadingSpinner label="Connecting..." />}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4">
            <div className="flex items-center gap-2 text-red-700">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm font-medium">{formatErrorMessage(error)}</p>
            </div>
          </div>
        )}

        {connectMutation.isSuccess && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-center gap-2 text-green-700">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <p className="text-sm font-medium">
                Repository connected successfully!
              </p>
            </div>
          </div>
        )}

        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={() => {
                if (!showSuggestions && suggestedRepos.length === 0) {
                  loadSuggestions();
                }
                setShowSuggestions(!showSuggestions);
              }}
              className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Browse your GitHub repositories
            </button>
            <span className="text-slate-300">|</span>
            <span className="text-sm text-slate-400">
              or enter manually below
            </span>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-4"
          >
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Owner
              </label>
              <input
                type="text"
                name="owner"
                required
                value={formData.owner}
                onChange={(e) =>
                  setFormData({ ...formData, owner: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20 outline-none transition-all"
                placeholder="owner-name"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Repository
              </label>
              <input
                type="text"
                name="repo"
                required
                value={formData.repo}
                onChange={(e) =>
                  setFormData({ ...formData, repo: e.target.value })
                }
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
                {connectMutation.isPending ? "Connecting..." : "Connect"}
              </button>
            </div>
          </form>

          {/* Suggestions Panel */}
          {showSuggestions && (
            <div className="mt-4 border border-slate-200 rounded-lg bg-slate-50">
              <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-white rounded-t-lg">
                <span className="text-sm font-medium text-slate-700">
                  Your GitHub Repositories
                </span>
                <div className="flex items-center gap-2">
                  {loadingSuggestions && (
                    <span className="text-xs text-slate-400">Loading...</span>
                  )}
                  {!loadingSuggestions && (
                    <span className="text-xs text-slate-400">
                      {suggestedRepos.length} repos
                    </span>
                  )}
                  <button
                    onClick={() => setShowSuggestions(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              {loadingSuggestions ? (
                <div className="p-8 text-center text-slate-500">
                  Loading repositories...
                </div>
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
                          <svg
                            className="h-4 w-4 text-slate-500"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {repo.full_name}
                          </p>
                          {repo.description && (
                            <p className="text-xs text-slate-500 truncate">
                              {repo.description}
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${repo.private ? "bg-slate-200 text-slate-600" : "bg-green-100 text-green-700"}`}
                        >
                          {repo.private ? "Private" : "Public"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : suggestionsError ? (
                <div className="p-6 text-center bg-white rounded-b-lg">
                  <p className="text-red-500 text-sm mb-2">
                    {formatErrorMessage(suggestionsError)}
                  </p>
                  <p className="text-red-500 text-sm mb-2">
                    {formatErrorMessage(suggestionsError)}
                  </p>
                  <button
                    onClick={loadSuggestions}
                    className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 bg-white rounded-b-lg">
                  No repositories found. Make sure your GitHub token has the
                  required permissions.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Repositories List with Filters & Search */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Connected Repositories
            </h2>

            {/* Search & Filter Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20 outline-none w-48"
                />
              </div>

              {/* Filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20 outline-none"
              >
                <option value="all">All</option>
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>

              {/* Sort */}
              <select
                value={`${sortField}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split("-") as [
                    SortField,
                    SortOrder,
                  ];
                  setSortField(field);
                  setSortOrder(order);
                }}
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20 outline-none"
              >
                <option value="lastSyncedAt-desc">Last Synced (Newest)</option>
                <option value="lastSyncedAt-asc">Last Synced (Oldest)</option>
                <option value="fullName-asc">Name (A-Z)</option>
                <option value="fullName-desc">Name (Z-A)</option>
                <option value="createdAt-desc">Created (Newest)</option>
                <option value="createdAt-asc">Created (Oldest)</option>
              </select>
            </div>
          </div>

          {/* Results count */}
          <p className="text-sm text-slate-500 mt-3">
            Showing {paginatedRepos.length} of {filteredAndSortedRepos.length}{" "}
            repositories
          </p>
        </div>

        {repositoriesQuery.isLoading && (
          <div className="p-8">
            <LoadingSpinner label="Loading repositories..." />
          </div>
        )}

        {paginatedRepos.length > 0 ? (
          <>
            <div className="divide-y divide-slate-200">
              {paginatedRepos.map((repo) => (
                <div
                  key={repo.id}
                  className="px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <svg
                          className="h-5 w-5 text-slate-600"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">
                          {repo.fullName}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-medium ${repo.isPrivate ? "bg-slate-100 text-slate-600 border border-slate-200" : "bg-green-50 text-green-700 border border-green-200"}`}
                          >
                            {repo.isPrivate ? "Private" : "Public"}
                          </span>
                          {repo.role && (
                            <span className="text-xs font-semibold text-slate-500 bg-slate-50/50 border border-slate-200 px-2 py-0.5 rounded-lg flex items-center gap-1 flex-shrink-0">
                              {repo.role === "leader"
                                ? "✦ Leader"
                                : repo.role === "dev"
                                  ? "⌘ Developer"
                                  : "👁 Viewer"}
                            </span>
                          )}
                          <span>
                            Last synced:{" "}
                            {repo.lastSyncedAt
                              ? new Date(repo.lastSyncedAt).toLocaleString(
                                  "en-GB",
                                )
                              : "Never"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          localStorage.setItem("selectedRepositoryId", repo.id);
                          window.dispatchEvent(new Event("repoChanged"));
                          navigate("/dashboard");
                        }}
                        className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-100 rounded-lg transition-colors"
                      >
                        View Dashboard
                      </button>
                      <button
                        onClick={() => {
                          localStorage.setItem("selectedRepositoryId", repo.id);
                          window.dispatchEvent(new Event("repoChanged"));
                          navigate(`/repositories/${repo.id}/sync-status`);
                        }}
                        className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
                      >
                        Sync Status
                      </button>
                      <button
                        onClick={() =>
                          handleDisconnect({
                            id: repo.id,
                            fullName: repo.fullName,
                          })
                        }
                        className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 text-sm font-medium rounded-lg transition-colors ${
                          currentPage === pageNum
                            ? "bg-slate-900 text-white"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          !repositoriesQuery.isLoading && (
            <div className="p-12 text-center">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="h-8 w-8 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                  />
                </svg>
              </div>
              <p className="text-slate-500">
                {searchQuery || filterType !== "all"
                  ? "No repositories match your filters"
                  : "No repositories connected yet"}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {searchQuery || filterType !== "all"
                  ? "Try adjusting your search or filters"
                  : "Select a repository from your GitHub account above"}
              </p>
            </div>
          )
        )}
      </div>

      {/* Disconnect Confirmation Modal */}
      {disconnectRepo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Disconnect Repository
                </h3>
                <p className="text-sm text-slate-500">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p className="text-slate-600 mb-6">
              Are you sure you want to disconnect{" "}
              <strong>{disconnectRepo.fullName}</strong>? This will remove the
              repository connection and all associated sync data.
            </p>

            {disconnectError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700">
                  {formatErrorMessage(disconnectError)}
                </p>
                <p className="text-sm text-red-700">
                  {formatErrorMessage(disconnectError)}
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDisconnectRepo(null)}
                disabled={disconnectMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDisconnect}
                disabled={disconnectMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {disconnectMutation.isPending
                  ? "Disconnecting..."
                  : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectRepositoryPage;
