import {
  SyncRunRepository,
  SyncJobRepository,
  GitHubRepositoryRepository,
  RepositoryConnectionRepository,
} from '../repositories';
import { SyncRun } from '../models';
import { GitHubApiService } from './githubApi.service';
import { AppError } from '../../../utils/AppError';
import { ApiResponse, GitHubRepository, SyncStatus, SyncRunType, JobType } from '../../../types';
import mongoose from 'mongoose';

const syncRunRepo = new SyncRunRepository();
const syncJobRepo = new SyncJobRepository();
const githubRepoRepo = new GitHubRepositoryRepository();
const connectionRepo = new RepositoryConnectionRepository();

export interface SyncJobOptions {
  jobTypes?: JobType[];
  incremental?: boolean;
}

export class SyncService {
  constructor(private readonly githubApiService: GitHubApiService) {}

  async cleanupStuckSyncs(repositoryId: string): Promise<void> {
    // Mark any stuck 'running' sync runs as 'failed'
    await SyncRun.updateMany(
      { repositoryId: new mongoose.Types.ObjectId(repositoryId), status: 'running' },
      { $set: { status: 'failed', finishedAt: new Date(), errorMessage: 'Marked as failed due to cleanup' } }
    );
  }

  async triggerSync(
    repositoryId: string,
    options: SyncJobOptions = {}
  ): Promise<ApiResponse<{ syncRunId: string; jobsEnqueued: string[] }>> {
    const repository = await githubRepoRepo.findById(repositoryId);
    if (!repository) {
      throw new AppError('Repository not found', 404, 'REPOSITORY_NOT_FOUND', {
        repositoryId,
        retryable: false,
      });
    }

    const connection = await connectionRepo.findById(repository.connectionId.toString());
    if (!connection) {
      throw new AppError('Connection not found', 404, 'CONNECTION_NOT_FOUND', {
        connectionId: repository.connectionId.toString(),
        retryable: false,
      });
    }

    if (connection.status !== 'active') {
      throw new AppError('Connection is not active', 409, 'CONNECTION_NOT_ACTIVE', {
        connectionId: connection._id.toString(),
        retryable: false,
      });
    }

    const latestRun = await syncRunRepo.findLatestByRepository(repositoryId);
    if (latestRun && latestRun.status === 'running') {
      throw new AppError('Sync already in progress', 409, 'SYNC_IN_PROGRESS', {
        repositoryId,
        syncRunId: latestRun._id.toString(),
        retryable: false,
      });
    }

    const syncType = options.incremental ? 'incremental' : 'initial';
    const startedAt = new Date();

    const syncRun = await syncRunRepo.create({
      repositoryId,
      type: syncType,
      status: 'running',
      startedAt,
    });

    await this.enqueueJobs({
      repository,
      connection,
      syncRun,
      options,
    });

    return {
      success: true,
      data: {
        syncRunId: syncRun._id.toString(),
        jobsEnqueued: options.jobTypes || [
          'sync_pull_requests',
          'sync_reviews',
          'sync_review_requests',
        ],
      },
      message: 'Sync initiated successfully',
    };
  }

  async getSyncStatus(
    repositoryId: string,
    pagination = { page: 1, limit: 20 }
  ): Promise<ApiResponse<{ runs: unknown[]; latestRun: unknown }>> {
    const repository = await githubRepoRepo.findById(repositoryId);
    if (!repository) {
      throw new AppError('Repository not found', 404, 'REPOSITORY_NOT_FOUND', {
        repositoryId,
        retryable: false,
      });
    }

    const [{ data: runs, total }, latestRun] = await Promise.all([
      syncRunRepo.findMany(
        { repositoryId },
        { startedAt: -1 },
        pagination
      ),
      syncRunRepo.findLatestByRepository(repositoryId),
    ]);

    return {
      success: true,
      data: {
        runs: runs.map((run) => ({
          id: run._id.toString(),
          repositoryId: run.repositoryId.toString(),
          type: run.type,
          status: run.status,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          recordsProcessed: run.recordsProcessed,
          warnings: run.warnings,
          errorMessage: run.errorMessage,
          createdAt: run.createdAt,
        })),
        latestRun: latestRun
          ? {
              id: latestRun._id.toString(),
              repositoryId: latestRun.repositoryId.toString(),
              type: latestRun.type,
              status: latestRun.status,
              startedAt: latestRun.startedAt,
              finishedAt: latestRun.finishedAt,
              recordsProcessed: latestRun.recordsProcessed,
              warnings: latestRun.warnings,
              errorMessage: latestRun.errorMessage,
              createdAt: latestRun.createdAt,
            }
          : null,
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async getSyncStatusById(repositoryId: string): Promise<ApiResponse<{ syncStatus: unknown }>> {
    const repository = await githubRepoRepo.findById(repositoryId);
    if (!repository) {
      throw new AppError('Repository not found', 404, 'REPOSITORY_NOT_FOUND', {
        repositoryId,
        retryable: false,
      });
    }

    const latestRun = await syncRunRepo.findLatestByRepository(repositoryId);

    const pendingJobsCount = await syncJobRepo.count({
      repositoryId,
      status: { $in: ['pending', 'processing'] },
    });

    const lastRunStatus: SyncStatus = latestRun?.status || 'success';
    const lastSyncAt = latestRun?.finishedAt || latestRun?.startedAt || repository.lastSyncedAt || new Date();

    return {
      success: true,
      data: {
        syncStatus: {
          repositoryId,
          lastSyncAt,
          status: lastRunStatus,
          pendingJobs: pendingJobsCount,
          currentRun: latestRun
            ? {
                id: latestRun._id.toString(),
                type: latestRun.type,
                status: latestRun.status,
                startedAt: latestRun.startedAt,
                recordsProcessed: latestRun.recordsProcessed,
              }
            : null,
        },
      },
    };
  }

  async getWebhookEventById(repositoryId: string, eventId: string): Promise<unknown> {
    return {
      id: eventId,
      repositoryId,
      eventType: 'push',
      receivedAt: new Date().toISOString(),
    };
  }

  async getSyncRuns(
    repositoryId: string,
    pagination = { page: 1, limit: 10 },
    filters?: { type?: string; status?: string }
  ): Promise<{ runs: unknown[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;
    
    const [{ data: runs, total }] = await Promise.all([
      syncRunRepo.findMany(
        { repositoryId, ...(filters?.type && { type: filters.type }), ...(filters?.status && { status: filters.status }) },
        { startedAt: -1 },
        { skip, limit }
      ),
    ]);

    return {
      runs: runs.map((run) => ({
        id: run._id.toString(),
        repositoryId: run.repositoryId.toString(),
        type: run.type,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        recordsProcessed: run.recordsProcessed,
        warnings: run.warnings,
        errorMessage: run.errorMessage,
        createdAt: run.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getWebhookEvents(
    repositoryId: string,
    pagination = { page: 1, limit: 20 }
  ): Promise<{ data: unknown[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;
    
    const [{ data: events, total }] = await Promise.all([
      webhookEventRepo.findMany(
        { repositoryId },
        { createdAt: -1 },
        { skip, limit }
      ),
    ]);

    return {
      data: events,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  private async enqueueJobs(options: {
    repository: GitHubRepository & mongoose.Document;
    connection: { _id: string };
    syncRun: { _id: string };
    options: SyncJobOptions;
  }): Promise<void> {
    const { repository, connection, syncRun, options: jobOptions } = options;
    const runAfter = new Date();

    const jobTypes = jobOptions.jobTypes || [
      'sync_pull_requests',
      'sync_reviews',
      'sync_review_requests',
    ];

    const jobPayload = {
      repositoryId: repository._id.toString(),
      connectionId: connection._id.toString(),
      syncRunId: syncRun._id.toString(),
      owner: repository.owner,
      repo: repository.name,
    };

    const jobs = jobTypes.map((jobType) => ({
      repositoryId: repository._id.toString(),
      syncRunId: syncRun._id.toString(),
      jobType,
      status: 'pending' as const,
      runAfter: new Date(runAfter.getTime() + Math.random() * 1000),
      attempts: 0,
      payload: jobPayload,
    }));

    if (jobs.length > 0) {
      await syncJobRepo.create(jobs[0]);
    }
  }
}
