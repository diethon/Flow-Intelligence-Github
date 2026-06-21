export interface GitHubApiConfig {
  token: string;
  baseUrl?: string;
}

export interface GitHubTokenValidationResponse {
  login: string;
  id: number;
  name?: string;
  email?: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  merged_at?: string;
  head: {
    repo?: {
      name: string;
      full_name: string;
    };
  };
}

export interface GitHubReview {
  id: number;
  user: {
    id: number;
    login: string;
    avatar_url: string;
  };
  state: string;
  submitted_at: string;
}

export interface GitHubReviewRequest {
  id: number;
  user: {
    id: number;
    login: string;
    avatar_url: string;
  };
  created_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type GitHubWebhookEventType = 'pull_request' | 'pull_request_review' | 'push';
export type JobType =
  | 'sync_pull_requests'
  | 'sync_reviews'
  | 'sync_review_requests'
  | 'sync_commits'
  | 'sync_issues'
  | 'sync_check_runs';
export type SyncRunType = 'initial' | 'incremental';
export type SyncStatus = 'pending' | 'running' | 'success' | 'failed' | 'error' | 'partial';
export type RepositoryConnectionStatus = 'active' | 'inactive' | 'error';

export interface GitHubRepository {
  id: string;
  connectionId: string;
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RepositoryConnection {
  id: string;
  userId: string;
  providerType: 'github';
  installationId?: string;
  tokenEncrypted: string;
  status: RepositoryConnectionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEvent {
  id: string;
  repositoryId: string;
  githubDeliveryId: string;
  eventType: string;
  action?: string;
  payload: Record<string, unknown>;
  receivedAt: Date;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type SyncStatus = 'pending' | 'running' | 'success' | 'error';

export interface SyncRun {
  id: string;
  repositoryId: string;
  type: SyncRunType;
  status: SyncStatus;
  startedAt: Date;
  finishedAt?: Date;
  recordsProcessed?: number;
  warnings?: string[];
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncJob {
  id: string;
  repositoryId: string;
  jobType: JobType;
  status: 'pending' | 'processing' | 'success' | 'error';
  runAfter: Date;
  attempts: number;
  payload: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface FilterOptions {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
