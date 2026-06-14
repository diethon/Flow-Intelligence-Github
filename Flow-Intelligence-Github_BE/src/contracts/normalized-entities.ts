export interface ContributorDTO {
  repositoryId: string;
  githubUserId: number;
  login: string;
  displayName: string; // masked if privacy enabled
  avatarUrl?: string;
}

export interface PullRequestDTO {
  repositoryId: string;
  githubPrId: number;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  isDraft: boolean;
  authorId: string;
  createdAt: Date;
  readyForReviewAt?: Date;
  mergedAt?: Date;
  closedAt?: Date;
  additions: number;
  deletions: number;
  changedFiles: number;
}

export interface ReviewDTO {
  repositoryId: string;
  pullRequestId: string;
  githubReviewId: number;
  reviewerId: string;
  state: 'approved' | 'changes_requested' | 'commented' | 'pending' | 'dismissed';
  submittedAt: Date;
}

export interface ReviewRequestDTO {
  pullRequestId: string;
  requestedReviewerId: string;
  requestedAt: Date;
}

export interface IssueDTO {
  repositoryId: string;
  githubIssueId: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  authorId: string;
  createdAt: Date;
  closedAt?: Date;
}

export interface CommitDTO {
  repositoryId: string;
  githubSha: string;
  message: string;
  authorId: string;
  committedAt: Date;
}

export interface CheckRunDTO {
  repositoryId: string;
  pullRequestId?: string;
  githubCheckId: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: string;
  startedAt: Date;
  completedAt?: Date;
}
