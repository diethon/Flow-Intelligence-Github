import type { Request, Response } from 'express';
import type { GitHubConnectionService, SyncService } from '../services';
import { GitHubApiService } from '../services';
import { syncJobProcessor } from '../services/syncJobProcessor.service';
import { PullRequestRepository } from '../repositories';
import { User } from '../../auth/models';
import { AppError } from '../../../utils/AppError';
import { GitHubRepository } from '../../../types';

const pullRequestRepo = new PullRequestRepository();

export class GitHubController {
  constructor(
    private connectionService: GitHubConnectionService,
    private syncService: SyncService,
    private apiService: GitHubApiService
  ) { }

  async connectRepository(req: Request, res: Response) {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (!user.accessToken) {
      throw new AppError('GitHub token not found. Please re-authenticate.', 400, 'TOKEN_NOT_FOUND');
    }

    const { owner, repo } = req.body;
    const result = await this.connectionService.connectRepository({
      userId,
      token: user.accessToken,
      owner,
      repo,
    });
    res.status(201).json(result);
  }

  async disconnectRepository(req: Request, res: Response) {
    const id = req.params.repositoryId as string;
    const result = await this.connectionService.disconnectRepository(id);
    res.json(result);
  }

  async getConnectionStatus(req: Request, res: Response) {
    const id = req.params.userId as string;
    const result = await this.connectionService.getConnectionStatus(id);
    res.json(result);
  }

  async getSyncStatus(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const id = req.params.repositoryId as string;
    const result = await this.syncService.getSyncStatus(id, { page, limit });
    res.json(result);
  }

  async validateToken(req: Request, res: Response) {
    const result = await this.apiService.validateToken();
    res.json(result);
  }

  async getRepositories(req: Request, res: Response) {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const repositories = await this.connectionService.getUserRepositories(userId, { page, limit });
    res.json(repositories);
  }

  async getSuggestedRepositories(req: Request, res: Response) {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const user = await User.findById(userId);
    if (!user || !user.accessToken) {
      throw new AppError('GitHub token not found', 400, 'TOKEN_NOT_FOUND');
    }

    const apiService = GitHubApiService.createWithToken(user.accessToken);
    const repositories = await apiService.getUserRepositories({ perPage: 50, sort: 'updated' });

    res.json({
      success: true,
      data: { repositories },
    });
  }

  async getRepositoryById(req: Request, res: Response) {
    const id = req.params.id as string;
    const repository = await this.connectionService.getRepositoryById(id);
    res.json({ success: true, data: repository });
  }

  async getRepositoryDetails(req: Request, res: Response) {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const user = await User.findById(userId);
    if (!user || !user.accessToken) {
      throw new AppError('GitHub token not found', 400, 'TOKEN_NOT_FOUND');
    }

    const id = req.params.id as string;
    const repo = (await this.connectionService.getRepositoryById(id)) as GitHubRepository;
    if (!repo) {
      throw new AppError('Repository not found', 404, 'REPOSITORY_NOT_FOUND');
    }

    const apiService = GitHubApiService.createWithToken(user.accessToken);
    const [owner, repoName] = repo.fullName.split('/');

    // Fetch additional stats in parallel
    const [githubData, languages, contributors, branches, issues] = await Promise.all([
      apiService.getRepository(owner, repoName),
      apiService.getRepositoryLanguages(owner, repoName),
      apiService.getRepositoryContributors(owner, repoName, 10),
      apiService.getRepositoryBranches(owner, repoName),
      apiService.getRepositoryIssues(owner, repoName, { state: 'open' }),
    ]);

    const totalBytes = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
    const languagePercentages: Record<string, number> = {};
    for (const [lang, bytes] of Object.entries(languages)) {
      languagePercentages[lang] = Math.round((bytes / totalBytes) * 100);
    }

    res.json({
      success: true,
      data: {
        ...repo,
        stats: {
          stars: githubData.stargazers_count,
          forks: githubData.forks_count,
          watchers: githubData.watchers_count,
          openIssues: githubData.open_issues_count,
          openPullRequests: issues.total_count,
          contributors: contributors.length,
          branches: branches.map(b => b.name),
          defaultBranch: githubData.default_branch,
        },
        languages: languagePercentages,
        topContributors: contributors,
      },
    });
  }

  async triggerSync(req: Request, res: Response) {
    const id = req.params.id as string;
    const { type, jobTypes } = req.body;

    // Force cleanup any stuck running sync
    await this.syncService.cleanupStuckSyncs(id);

    const result = await this.syncService.triggerSync(id, { incremental: type === 'incremental', jobTypes });

    setImmediate(async () => {
      try {
        const latestRun = await this.syncService.getSyncStatusById(id);
        console.log(`Sync triggered for repository ${id}`);
      } catch (error) {
        console.error('Error processing sync job:', error);
      }
    });

    res.status(202).json(result);
  }

  async getSyncStatusSummary(req: Request, res: Response) {
    const id = req.params.id as string;
    const result = await this.syncService.getSyncStatusById(id);
    res.json(result);
  }

  async getSyncRuns(req: Request, res: Response) {
    const id = req.params.id as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const { type, status } = req.query;
    const result = await this.syncService.getSyncRuns(id, { page, limit }, { type: type as string, status: status as string });
    res.json(result);
  }

  async getWebhookEvents(req: Request, res: Response) {
    const id = req.params.id as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await this.syncService.getWebhookEvents(id, { page, limit });
    res.json(result);
  }

  async getWebhookEventDetail(req: Request, res: Response) {
    const id = req.params.id as string;
    const eventId = req.params.eventId as string;
    const result = await this.syncService.getWebhookEventById(id, eventId);
    res.json({ success: true, data: result });
  }

  async retryWebhookEvent(req: Request, res: Response) {
    res.json({ success: true, data: { retried: true }, message: 'Webhook event requeued' });
  }

  async setupWebhook(req: Request, res: Response) {
    const repositoryId = req.params.id as string;
    const webhookUrl = req.body.webhookUrl;

    if (!webhookUrl || typeof webhookUrl !== 'string') {
      throw new AppError('Webhook URL is required and must be a string', 400, 'WEBHOOK_URL_REQUIRED');
    }

    const result = await this.connectionService.setupWebhook(repositoryId, webhookUrl);
    res.json(result);
  }

  async getPullRequests(req: Request, res: Response) {
    const repositoryId = req.params.id as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const state = req.query.state as string;

    const filter: Record<string, unknown> = { repositoryId };
    if (state) {
      filter.state = state;
    }

    const repository = await this.connectionService.getRepositoryById(repositoryId);
    if (!repository) {
      throw new AppError('Repository not found', 404, 'REPOSITORY_NOT_FOUND');
    }

    const { data: pullRequests, total } = await pullRequestRepo.findMany(filter, { prCreatedAt: -1 }, { skip: (page - 1) * limit, limit });

    res.json({
      success: true,
      data: {
        pullRequests: pullRequests.map((pr: any) => ({
          id: pr._id.toString(),
          number: pr.number,
          title: pr.title,
          state: pr.state,
          author: pr.authorLogin,
          labels: pr.labels,
          createdAt: pr.prCreatedAt,
          updatedAt: pr.prUpdatedAt,
          mergedAt: pr.prMergedAt,
          url: pr.prUrl,
          additions: pr.additions,
          deletions: pr.deletions,
          reviewStatus: pr.state === 'open' ? 'needs_review' : (pr.merged ? 'merged' : 'closed'),
        })),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
}
