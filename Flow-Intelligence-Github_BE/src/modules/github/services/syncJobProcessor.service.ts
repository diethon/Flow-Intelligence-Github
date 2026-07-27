import mongoose from 'mongoose';
import { GitHubApiService } from './githubApi.service';
import { RepositoryConnectionRepository, GitHubRepositoryRepository, SyncRunRepository, SyncJobRepository } from '../repositories';
import { PullRequest, Review, ReviewRequest } from '../models';
import { Commit } from '../../../models/commit.model';
import { notificationService } from './notification.service';
import { normalizationService } from '../../../services/normalization.service';
import { IssueImport, CommitImport, CheckRunImport } from '../../../dto/import.dto';
import { AppError } from '../../../utils/AppError';
import { encryptToken, decryptToken } from '../../../utils/crypto';
import { User } from '../../auth/models';
import { PredictionService } from '../../../services/PredictionService';
import { evidenceCardService } from '../../../services/evidenceCard.service';

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
        case 'sync_commits':
          await this.syncCommits(payload, apiService);
          break;
        case 'sync_issues':
          await this.syncIssues(payload, apiService);
          break;
        case 'sync_check_runs':
          await this.syncCheckRuns(payload, apiService);
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

    const syncedOpenPrIds: string[] = [];

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

        const prId = await this.upsertPullRequest(payload.repositoryId, pr);
        
        // Orchestration: Only collect PRs that are "open" to avoid overloading ML Prediction process
        const prState = pr.merged_at ? 'merged' : pr.state;
        if (prState === 'open' && prId) {
          syncedOpenPrIds.push(prId.toString());
        }
        
        prCount++;
      }

      if (prs.length < perPage) {
        hasMore = false;
      } else {
        page++;
      }
    }

    // Orchestration Trigger: Run predictions sequentially for updated OPEN pull requests
    if (syncedOpenPrIds.length > 0) {
      console.log(`[ML] Triggering delay risk prediction for ${syncedOpenPrIds.length} open PRs...`);
      for (const prId of syncedOpenPrIds) {
        try {
          const prediction = await PredictionService.predictAndSave(payload.repositoryId, prId);
          console.log(`[ML] Prediction for PR ${prId}: ${prediction.riskLabel} Risk (${(prediction.probability * 100).toFixed(1)}%)`);
          
          if (prediction.riskLabel === 'High' || prediction.riskLabel === 'Medium') {
            await evidenceCardService.generateFromPrediction(payload.repositoryId, {
              pullRequestId: prId,
              predictionId: prediction.predictionId || undefined,
              probability: prediction.probability,
              riskLabel: prediction.riskLabel,
              modelVersion: prediction.modelVersionId,
              limitation: "Generated automatically after GitHub Sync.",
            });
          }
        } catch (err) {
          console.error(`[ML Error] Failed to process prediction for PR ${prId}:`, err);
        }
      }
    }

    await repositoryRepo.update(payload.repositoryId, { lastSyncedAt: new Date() });
    console.log(`Synced ${prCount} pull requests for ${owner}/${repo}`);
  }

  private async upsertContributor(repositoryId: mongoose.Types.ObjectId, githubUser: any): Promise<mongoose.Types.ObjectId | null> {
    if (!githubUser || (!githubUser.id && !githubUser.login)) return null;
    const { Contributor } = await import('../../../models/index.js');
    const login = githubUser.login || 'unknown';
    const userId = githubUser.id || 0;

    const existing = await Contributor.findOne({
      $or: [
        { repositoryId, githubUserId: userId },
        { repositoryId, login }
      ]
    });

    if (existing) {
      if (existing.login !== login || existing.avatarUrl !== (githubUser.avatar_url || '')) {
        await Contributor.updateOne(
          { _id: existing._id },
          {
            login,
            displayName: githubUser.name || login,
            avatarUrl: githubUser.avatar_url || '',
          }
        );
      }
      return existing._id as mongoose.Types.ObjectId;
    }

    try {
      const created = await Contributor.create({
        repositoryId,
        githubUserId: userId,
        login,
        displayName: githubUser.name || login,
        avatarUrl: githubUser.avatar_url || '',
        isPseudonymized: false,
        pseudoLogin: '',
      });
      return created._id as mongoose.Types.ObjectId;
    } catch (error: any) {
      if (error.code === 11000 || error.message?.includes('E11000')) {
        const reFound = await Contributor.findOne({
          $or: [
            { repositoryId, githubUserId: userId },
            { repositoryId, login }
          ]
        });
        if (reFound) return reFound._id as mongoose.Types.ObjectId;
      }
      throw error;
    }
  }

  private async upsertPullRequest(repositoryId: string, pr: any): Promise<mongoose.Types.ObjectId> {
    const repoId = new mongoose.Types.ObjectId(repositoryId);

    // Find by (repositoryId + number) OR githubPrId to avoid E11000 duplicate key error
    const existing = await PullRequest.findOne({
      $or: [
        { repositoryId: repoId, number: pr.number },
        { githubPrId: pr.id }
      ]
    });

    const prState = pr.merged ? 'merged' : pr.state;
    const authorId = await this.upsertContributor(repoId, pr.user);

    const prData = {
      repositoryId: repoId,
      githubPrId: pr.id,
      number: pr.number,
      title: pr.title,
      state: prState,
      body: pr.body || '',
      authorId: authorId || new mongoose.Types.ObjectId(), // fallback
      authorGithubId: pr.user?.id || 0,
      authorLogin: pr.user?.login || 'unknown',
      headRef: pr.head?.ref || '',
      baseRef: pr.base?.ref || '',
      headRepoFullName: pr.head?.repo?.full_name,
      baseRepoFullName: pr.base?.repo?.full_name || `${pr.base?.user?.login}/${pr.base?.repo?.name}`,
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      changedFiles: pr.changed_files || 0,
      commits: pr.commits || 0,
      createdAt: new Date(pr.created_at),
      prCreatedAt: new Date(pr.created_at),
      prUpdatedAt: new Date(pr.updated_at),
      closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
      prClosedAt: pr.closed_at ? new Date(pr.closed_at) : undefined,
      mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
      prMergedAt: pr.merged_at ? new Date(pr.merged_at) : undefined,
      readyForReviewAt: pr.draft ? null : new Date(pr.created_at),
      prUrl: pr.html_url,
      draft: pr.draft || false,
      isDraft: pr.draft || false,
      mergeable: pr.mergeable,
      merged: pr.merged || false,
      labels: pr.labels?.map((l: any) => l.name) || [],
      assignees: pr.assignees?.map((a: any) => a.login) || [],
      requestedReviewers: pr.requested_reviewers?.map((r: any) => r.login) || [],
    };

    if (existing) {
      await PullRequest.updateOne({ _id: existing._id }, prData);
      return existing._id as mongoose.Types.ObjectId;
    } else {
      try {
        const created = await PullRequest.create(prData);
        return created._id as mongoose.Types.ObjectId;
      } catch (error: any) {
        if (error.code === 11000 || error.message?.includes('E11000')) {
          const reFound = await PullRequest.findOne({
            $or: [
              { repositoryId: repoId, number: pr.number },
              { githubPrId: pr.id }
            ]
          });
          if (reFound) {
            await PullRequest.updateOne({ _id: reFound._id }, prData);
            return reFound._id as mongoose.Types.ObjectId;
          }
        }
        throw error;
      }
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
    const repoObjectId = new mongoose.Types.ObjectId(repositoryId);
    const reviewerId = await this.upsertContributor(repoObjectId, review.user);

    const reviewData = {
      pullRequestId: new mongoose.Types.ObjectId(pullRequestId),
      repositoryId: repoObjectId,
      githubReviewId: review.id,
      reviewerId: reviewerId || new mongoose.Types.ObjectId(), // fallback
      githubUserId: review.user?.id || 0,
      userLogin: review.user?.login || 'unknown',
      userAvatarUrl: review.user?.avatar_url,
      state: (review.state as any) === 'PENDING' ? 'PENDING' : review.state as any,
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
    const repoObjectId = new mongoose.Types.ObjectId(repositoryId);
    const existing = await ReviewRequest.findOne({
      pullRequestId: new mongoose.Types.ObjectId(pullRequestId),
      githubUserId: request.user?.id || request.id,
    });
    const requestedReviewerId = await this.upsertContributor(repoObjectId, request.user || request);

    const requestData = {
      pullRequestId: new mongoose.Types.ObjectId(pullRequestId),
      repositoryId: repoObjectId,
      requestedReviewerId: requestedReviewerId || null,
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

  /**
   * Sync commit metadata (no diff/patch). Idempotent upsert keyed by
   * (repositoryId, githubSha) via normalizationService.
   */
  private async syncCommits(payload: SyncJobPayload, apiService: GitHubApiService): Promise<void> {
    const { owner, repo, repositoryId, since } = payload;
    let page = 1;
    const perPage = 100;
    let hasMore = true;
    let count = 0;

    while (hasMore) {
      const commits = await apiService.getCommits(owner, repo, { perPage, page, since });
      if (commits.length === 0) break;

      for (const c of commits) {
        const row: CommitImport = {
          githubSha: c.sha,
          authorGithubId: c.author?.id ?? undefined,
          authorLogin: c.author?.login ?? c.commit?.author?.name ?? undefined,
          message: c.commit?.message ?? undefined,
          committedAt: new Date(c.commit?.committer?.date ?? c.commit?.author?.date ?? Date.now()),
        };
        await normalizationService.upsertCommit(repositoryId, row);
        count++;
      }

      if (commits.length < perPage) hasMore = false;
      else page++;
    }

    console.log(`Synced ${count} commits for ${owner}/${repo}`);
  }

  /**
   * Sync issue metadata. GitHub's issues endpoint also returns pull requests;
   * rows carrying a `pull_request` field are skipped. Raw body is not stored.
   */
  private async syncIssues(payload: SyncJobPayload, apiService: GitHubApiService): Promise<void> {
    const { owner, repo, repositoryId, since } = payload;
    let page = 1;
    const perPage = 100;
    let hasMore = true;
    let count = 0;

    while (hasMore) {
      const issues = await apiService.getDetailedIssues(owner, repo, { state: 'all', perPage, page, since });
      if (issues.length === 0) break;

      for (const it of issues) {
        if (it.pull_request) continue; // skip PRs returned by the issues endpoint
        const state = it.state === 'closed' ? 'closed' : 'open';
        const row: IssueImport = {
          githubIssueId: it.id,
          number: it.number,
          title: it.title,
          state,
          authorGithubId: it.user?.id ?? 0,
          authorLogin: it.user?.login ?? 'unknown',
          labels: (it.labels || []).map((l: any) => (typeof l === 'string' ? l : l.name)).filter(Boolean),
          assignees: (it.assignees || []).map((a: any) => a.login).filter(Boolean),
          issueCreatedAt: new Date(it.created_at),
          issueUpdatedAt: new Date(it.updated_at),
          issueClosedAt: it.closed_at ? new Date(it.closed_at) : undefined,
          issueUrl: it.html_url,
        };
        await normalizationService.upsertIssue(repositoryId, row);
        count++;
      }

      if (issues.length < perPage) hasMore = false;
      else page++;
    }

    console.log(`Synced ${count} issues for ${owner}/${repo}`);
  }

  /**
   * Sync CI/CD check runs. Check runs are fetched per commit ref, so this job
   * must run after commits are synced. Iterates stored commit SHAs.
   */
  private async syncCheckRuns(payload: SyncJobPayload, apiService: GitHubApiService): Promise<void> {
    const { owner, repo, repositoryId } = payload;

    const commits = await Commit.find({ repositoryId: new mongoose.Types.ObjectId(repositoryId) })
      .select('githubSha')
      .sort({ committedAt: -1 })
      .limit(100);

    let count = 0;

    for (const commit of commits) {
      try {
        const checkRuns = await apiService.getCheckRunsForRef(owner, repo, commit.githubSha);
        for (const cr of checkRuns) {
          const status = (['queued', 'in_progress', 'completed'].includes(cr.status) ? cr.status : 'completed') as CheckRunImport['status'];
          const row: CheckRunImport = {
            githubCheckId: cr.id,
            name: cr.name,
            status,
            conclusion: cr.conclusion ?? undefined,
            headSha: cr.head_sha ?? commit.githubSha,
            startedAt: cr.started_at ? new Date(cr.started_at) : undefined,
            completedAt: cr.completed_at ? new Date(cr.completed_at) : undefined,
            detailsUrl: cr.details_url ?? undefined,
          };
          await normalizationService.upsertCheckRun(repositoryId, row);
          count++;
        }
      } catch (error) {
        console.error(`Failed to sync check runs for ${commit.githubSha}:`, error);
      }
    }

    console.log(`Synced ${count} check runs for ${owner}/${repo}`);
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
