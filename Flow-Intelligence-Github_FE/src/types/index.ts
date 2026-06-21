export type RepositoryConnectionStatus = 'active' | 'inactive' | 'error';
export type SyncStatus = 'running' | 'success' | 'partial' | 'failed';
export type SyncRunType = 'initial' | 'incremental' | 'webhook';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type JobType = 'sync_pull_requests' | 'sync_reviews' | 'sync_review_requests' | 'sync_commits' | 'sync_issues';

export interface RepositoryConnection {
  id: string;
  userId: string;
  providerType: string;
  installationId?: string;
  status: RepositoryConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubRepository {
  id: string;
  connectionId: string;
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  description?: string;
  defaultBranch: string;
  isPrivate: boolean;
  language?: string;
  stars?: number;
  forks?: number;
  watchers?: number;
  openIssues?: number;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryStats {
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  openPullRequests: number;
  contributors: number;
  branches: string[];
  defaultBranch: string;
}

export interface RepositoryDetails extends GitHubRepository {
  stats: RepositoryStats;
  languages: Record<string, number>;
  topContributors: { login: string; avatar_url: string; contributions: number }[];
}

export interface SyncRun {
  id: string;
  repositoryId: string;
  type: SyncRunType;
  status: SyncStatus;
  startedAt: string;
  finishedAt?: string;
  recordsProcessed: number;
  warnings?: string[];
  errorMessage?: string;
  createdAt: string;
}

export interface SyncJob {
  id: string;
  repositoryId: string;
  jobType: JobType;
  status: JobStatus;
  runAfter: string;
  attempts: number;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEvent {
  id: string;
  repositoryId: string;
  githubDeliveryId: string;
  eventType: string;
  action?: string;
  payload: Record<string, unknown>;
  receivedAt: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncStatusJob {
  id: string;
  jobType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  updatedAt: string;
}

export interface RepositorySyncStatus {
  repositoryId: string;
  lastSyncAt: string;
  status: SyncStatus;
  pendingJobs: number;
  currentRun?: {
    id: string;
    type: SyncRunType;
    status: SyncStatus;
    startedAt: string;
    recordsProcessed: number;
    jobs?: SyncStatusJob[];
  };
}

export interface SyncStatusResponse {
  success: boolean;
  data?: {
    syncStatus: {
      status: SyncStatus;
      lastSyncAt: string;
      pendingJobs: number;
      currentRun?: {
        id: string;
        type: SyncRunType;
        status: SyncStatus;
        startedAt: string;
        recordsProcessed: number;
        jobs?: SyncStatusJob[];
      };
    };
  };
}

export interface PaginatedResponse<T> {
  runs?: T[];
  data?: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ConnectRepositoryPayload {
  owner: string;
  repo: string;
}

export interface SyncRepositoryPayload {
  type?: 'initial' | 'incremental';
  jobTypes?: JobType[];
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  user: {
    id: number;
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  closed_at?: string;
  merged_at?: string;
  html_url: string;
  head: {
    ref: string;
    sha: string;
    repo?: {
      name: string;
      full_name: string;
    };
  };
  base: {
    ref: string;
    sha: string;
  };
}

export interface GitHubReview {
  id: number;
  user: {
    id: number;
    login: string;
    avatar_url: string;
  };
  body?: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED';
  submitted_at: string;
  html_url: string;
}

// ── Risk & Evidence (UC-16 / E6-S3) ───────────────────────────────────────────
export type EvidenceSeverity = 'low' | 'medium' | 'high';
export type EvidenceConfidence = 'low' | 'medium' | 'high';
export type EvidenceSourceType = 'risk_event' | 'prediction';
export type EvidenceEntityType = 'pull_request' | 'issue' | 'commit' | 'check_run';

export interface EvidenceItem {
  entityType: EvidenceEntityType;
  entityId: string;
  sourceLabel: string;
  sourceUrl: string;
  summary: string;
}

export interface EvidenceCard {
  _id: string;
  repositoryId: string;
  riskEventId?: string;
  predictionId?: string;
  sourceType: EvidenceSourceType;
  title: string;
  severity: EvidenceSeverity;
  summary: string;
  evidence: EvidenceItem[];
  suggestedAction: string;
  confidence: EvidenceConfidence;
  limitation: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceListParams {
  severity?: EvidenceSeverity;
  sourceType?: EvidenceSourceType;
  page?: number;
  limit?: number;
}
