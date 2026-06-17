import mongoose from 'mongoose';
import { GitHubApiService } from './githubApi.service';
import { RepositoryConnectionRepository, GitHubRepositoryRepository, SyncRunRepository, SyncJobRepository } from '../repositories';
import { PullRequest } from '../models/pullRequest.model';
import { Review } from '../models/review.model';
import { ReviewRequest } from '../models/reviewRequest.model';
import { notificationService } from './notification.service';
import { AppError } from '../../../utils/AppError';
import { encryptToken, decryptToken } from '../../../utils/crypto';
import { User } from '../../auth/models';

const connectionRepo = new RepositoryConnectionRepository();
const repositoryRepo = new GitHubRepositoryRepository();
const syncRunRepo = new SyncRunRepository();
const syncJobRepo = new SyncJobRepository();

export interface SyncJobPayload {
  repositoryId: string;
  connectionId: string;
  syncRunId: string;
  owner: string;
  repo: string;
  since?: string;
}

export class SyncJobProcessor {
  async processJob(jobId: string): Promise<void> {
    const job = await syncJobRepo.findById(jobId);
    if (!job) {
      throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
    }

    await syncJobRepo.updateStatus(jobId, 'processing');

    const payload = job.payload as SyncJobPayload;

    try {
      const repository = await repositoryRepo.findById(payload.repositoryId);
      if (!repository) {
        throw new AppError('Repository not found', 404, 'REPOSITORY_NOT_FOUND');
      }

      const connection = await connectionRepo.findById(payload.connectionId);
      if (!connection) {
        throw new AppError('Connection not found', 404, 'CONNECTION_NOT_FOUND');
      }

      const decryptedToken = decryptToken(connection.tokenEncrypted);

      const apiService = new GitHubApiService({ token: decryptedToken });

      switch (job.jobType) {
        case 'sync_pull_requests':
          await this.syncPullRequests(payload, apiService);
          break;
        case 'sync_reviews':
          await this.syncReviews(payload, apiService);
          break;
        case 'sync_review_requests':
          await this.syncReviewRequests(payload, apiService);
          break;
      }

      await syncJobRepo.updateStatus(jobId, 'completed', { itemsProcessed: 1 });
      await syncRunRepo.incrementRecordsProcessed(payload.syncRunId);

      await this.checkAndCompleteSyncRun(payload.syncRunId);
    } catch (error) {
      await syncJobRepo.updateStatus(jobId, 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      await syncRunRepo.markError(payload.syncRunId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private async syncPullRequests(payload: SyncJobPayload, apiService: GitHubApiService): Promise<void> {
    const { owner, repo, since } = payload;
    let page = 1;
    const perPage = 100;
    let hasMore = true;
    let prCount = 0;

    while (hasMore) {
      const prs = await apiService.getPullRequests(owner, repo, {
        state: 'all',
        perPage,
        page,
      });

      if (prs.length === 0) {
        hasMore = false;
        break;
      }

      for (const pr of prs) {
        if (since) {
          const prDate = new Date(pr.created_at);
          if (prDate < new Date(since)) {
            hasMore = false;
            break;
          }
        }

        await this.upsertPullRequest(payload.repositoryId, pr);
        prCount++;
      }

      if (prs.length < perPage) {
        hasMore = false;
      } else {
        page++;
      }
    }

    await repositoryRepo.update(payload.repositoryId, { lastSyncedAt: new Date() });
    console.log(`Synced ${prCount} pull requests for ${owner}/${repo}`);
  }

  private async upsertPullRequest(repositoryId: string, pr: any): Promise<void> {
    const repoId = new mongoose.Types.ObjectId(repositoryId);

    const existing = await PullRequest.findOne({ githubPrId: pr.id });

    const prState = pr.merged ? 'merged' : pr.state;

    const prData = {
      repositoryId: repoId,
      githubPrId: pr.id,
      number: pr.number,
      title: pr.title,
      state: prState,
      body: pr.body || '',
      authorGithubId: pr.user?.id || 0,
      authorLogin: pr.user?.login || 'unknown',
      headRef: pr.head?.ref || '',
      baseRef: pr.base?.ref || '',
      headRepoFullName: pr.head?.repo?.full_name,
      baseRepoFullName: pr.base?.repo?.full_name || `${pr.base?.user?.login}/${pr.base?.repo?.name}`,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      commits: pr.commits,
      prCreatedAt: new Date(pr.created_at),
      prUpdatedAt: new Date(pr.updated_at),
      prClosedAt: pr.closed_at ? new Date(pr.closed_at) : undefined,
      prMergedAt: pr.merged_at ? new Date(pr.merged_at) : undefined,
      prUrl: pr.html_url,
      draft: pr.draft || false,
      mergeable: pr.mergeable,
      merged: pr.merged || false,
      labels: pr.labels?.map((l: any) => l.name) || [],
      assignees: pr.assignees?.map((a: any) => a.login) || [],
      requestedReviewers: pr.requested_reviewers?.map((r: any) => r.login) || [],
    };

    if (existing) {
      await PullRequest.updateOne({ _id: existing._id }, prData);
    } else {
      await PullRequest.create(prData);
    }
  }

  private async syncReviews(payload: SyncJobPayload, apiService: GitHubApiService): Promise<void> {
    const { owner, repo, repositoryId } = payload;

    const pullRequests = await PullRequest.find({ repositoryId: new mongoose.Types.ObjectId(repositoryId) })
      .select('_id number')
      .limit(100);

    let reviewCount = 0;

    for (const pr of pullRequests) {
      try {
        const reviews = await apiService.getReviews(owner, repo, pr.number);

        for (const review of reviews) {
          await this.upsertReview(pr._id.toString(), repositoryId, review);
          reviewCount++;
        }
      } catch (error) {
        console.error(`Failed to sync reviews for PR #${pr.number}:`, error);
      }
    }

    console.log(`Synced ${reviewCount} reviews for ${owner}/${repo}`);
  }

  private async upsertReview(pullRequestId: string, repositoryId: string, review: any): Promise<void> {
    const existing = await Review.findOne({ githubReviewId: review.id });

    const reviewData = {
      pullRequestId: new mongoose.Types.ObjectId(pullRequestId),
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
      githubReviewId: review.id,
      githubUserId: review.user?.id || 0,
      userLogin: review.user?.login || 'unknown',
      userAvatarUrl: review.user?.avatar_url,
      state: review.state as any,
      body: review.body || '',
      submittedAt: new Date(review.submitted_at),
    };

    if (existing) {
      await Review.updateOne({ _id: existing._id }, reviewData);
    } else {
      await Review.create(reviewData);
    }
  }

  private async syncReviewRequests(payload: SyncJobPayload, apiService: GitHubApiService): Promise<void> {
    const { owner, repo, repositoryId } = payload;

    const pullRequests = await PullRequest.find({ repositoryId: new mongoose.Types.ObjectId(repositoryId) })
      .select('_id number')
      .limit(100);

    let requestCount = 0;

    for (const pr of pullRequests) {
      try {
        const requests = await apiService.getReviewRequests(owner, repo, pr.number);

        for (const request of requests) {
          await this.upsertReviewRequest(pr._id.toString(), repositoryId, request);
          requestCount++;
        }
      } catch (error) {
        console.error(`Failed to sync review requests for PR #${pr.number}:`, error);
      }
    }

    console.log(`Synced ${requestCount} review requests for ${owner}/${repo}`);
  }

  private async upsertReviewRequest(pullRequestId: string, repositoryId: string, request: any): Promise<void> {
    const existing = await ReviewRequest.findOne({
      pullRequestId: new mongoose.Types.ObjectId(pullRequestId),
      githubUserId: request.user?.id || request.id,
    });

    const requestData = {
      pullRequestId: new mongoose.Types.ObjectId(pullRequestId),
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
      githubUserId: request.user?.id || request.id,
      userLogin: request.user?.login || request.login || 'unknown',
      userAvatarUrl: request.user?.avatar_url || request.avatar_url,
      requestedAt: new Date(request.created_at || Date.now()),
    };

    if (existing) {
      await ReviewRequest.updateOne({ _id: existing._id }, requestData);
    } else {
      await ReviewRequest.create(requestData);
    }
  }

  private async checkAndCompleteSyncRun(syncRunId: string): Promise<void> {
    const pendingJobs = await syncJobRepo.count({
      syncRunId: new mongoose.Types.ObjectId(syncRunId),
      status: { $in: ['pending', 'processing'] },
    });

    if (pendingJobs === 0) {
      const failedJobs = await syncJobRepo.count({
        syncRunId: new mongoose.Types.ObjectId(syncRunId),
        status: 'failed',
      });

      const status = failedJobs > 0 ? 'partial' : 'success';
      await syncRunRepo.updateStatus(syncRunId, status);

      const pullRequestsCount = await PullRequest.countDocuments({
        repositoryId: await this.getRepositoryObjectId(syncRunId),
      });
      const reviewsCount = await Review.countDocuments({
        repositoryId: await this.getRepositoryObjectId(syncRunId),
      });
      const reviewRequestsCount = await ReviewRequest.countDocuments({
        repositoryId: await this.getRepositoryObjectId(syncRunId),
      });

      await notificationService.onSyncComplete(syncRunId, syncRunId, {
        pullRequestsCount,
        reviewsCount,
        reviewRequestsCount,
      });
    }
  }

  private async getRepositoryObjectId(syncRunId: string): Promise<mongoose.Types.ObjectId> {
    const syncRun = await syncRunRepo.findById(syncRunId);
    return syncRun?.repositoryId as mongoose.Types.ObjectId;
  }
}

export const syncJobProcessor = new SyncJobProcessor();
