import { GitHubApiService } from './githubApi.service';
import {
  RepositoryConnectionRepository,
  GitHubRepositoryRepository,
  WebhookEventRepository,
} from '../repositories';
import { AppError } from '../../../utils/AppError';
import { ApiResponse, GitHubRepository } from '../../../types';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { SyncService } from './sync.service.js';

const repositoryConnectionRepo = new RepositoryConnectionRepository();
const githubRepositoryRepo = new GitHubRepositoryRepository();
const webhookEventRepo = new WebhookEventRepository();

export class GitHubConnectionService {
  async connectRepository(data: {
    userId: string;
    token: string;
    owner: string;
    repo: string;
  }): Promise<ApiResponse<{ repository: GitHubRepository; connectionId: string }>> {
    const userApiService = GitHubApiService.createWithToken(data.token);
    await userApiService.validateToken();
    const githubRepository = await userApiService.getRepository(data.owner, data.repo);

    const existingConnection = await repositoryConnectionRepo.findOne({
      userId: data.userId,
      providerType: 'github',
      status: 'active',
    });

    let connectionId: string;
    let tokenEncrypted: string;

    if (existingConnection) {
      tokenEncrypted = this.encryptToken(data.token);
      connectionId = existingConnection._id.toString();
      await repositoryConnectionRepo.update(existingConnection._id.toString(), {
        status: 'active',
        tokenEncrypted,
      });
    } else {
      tokenEncrypted = this.encryptToken(data.token);
      const connection = await repositoryConnectionRepo.create({
        userId: new mongoose.Types.ObjectId(data.userId) as any,
        providerType: 'github',
        tokenEncrypted,
        status: 'active',
      });
      connectionId = connection._id.toString();
    }

    let repositoryRecord = await githubRepositoryRepo.findByFullName(githubRepository.full_name);

    if (repositoryRecord) {
      repositoryRecord = await githubRepositoryRepo.update(repositoryRecord._id.toString(), {
        connectionId: new mongoose.Types.ObjectId(connectionId),
        githubRepoId: githubRepository.id,
        owner: githubRepository.owner.login,
        name: githubRepository.name,
        fullName: githubRepository.full_name,
        defaultBranch: githubRepository.default_branch,
        isPrivate: githubRepository.private,
      });
    } else {
      repositoryRecord = await githubRepositoryRepo.create({
        connectionId: new mongoose.Types.ObjectId(connectionId),
        githubRepoId: githubRepository.id,
        owner: githubRepository.owner.login,
        name: githubRepository.name,
        fullName: githubRepository.full_name,
        defaultBranch: githubRepository.default_branch,
        isPrivate: githubRepository.private,
      });
    }

    const connection = await repositoryConnectionRepo.findById(connectionId);

    // Auto-trigger sync upon successful connection to pull historical data
    try {
      const syncService = new SyncService(userApiService);
      await syncService.triggerSync(repositoryRecord._id.toString());
    } catch (syncError) {
      console.error('Failed to auto-trigger sync during repository connection:', syncError);
      // Proceed without failing the connection
    }

    return {
      success: true,
      data: {
        repository: {
          id: repositoryRecord._id.toString(),
          connectionId: repositoryRecord.connectionId.toString(),
          githubRepoId: repositoryRecord.githubRepoId,
          owner: repositoryRecord.owner,
          name: repositoryRecord.name,
          fullName: repositoryRecord.fullName,
          defaultBranch: repositoryRecord.defaultBranch,
          isPrivate: repositoryRecord.isPrivate,
          lastSyncedAt: repositoryRecord.lastSyncedAt,
          createdAt: repositoryRecord.createdAt,
          updatedAt: repositoryRecord.updatedAt,
        },
        connectionId: connection?._id.toString() || connectionId,
      },
      message: 'Repository connected successfully',
    };
  }

  async disconnectRepository(
    repositoryId: string
  ): Promise<ApiResponse<{ disconnected: boolean }>> {
    const repository = await githubRepositoryRepo.findById(repositoryId);
    if (!repository) {
      throw new AppError('Repository not found', 404, 'REPOSITORY_NOT_FOUND', {
        repositoryId,
        retryable: false,
      });
    }

    await githubRepositoryRepo.delete(repositoryId);
    await webhookEventRepo.deleteMany({ repositoryId });

    return {
      success: true,
      data: {
        disconnected: true,
      },
      message: 'Repository disconnected successfully',
    };
  }

  async getConnectionStatus(userId: string): Promise<ApiResponse<{ connections: unknown[] }>> {
    const connections = await repositoryConnectionRepo.findByUserId(userId);

    const connectionDtos = connections.map((connection) => ({
      id: connection._id.toString(),
      userId: connection.userId,
      providerType: connection.providerType,
      installationId: connection.installationId,
      status: connection.status,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    }));

    return {
      success: true,
      data: {
        connections: connectionDtos,
      },
    };
  }

  private encryptToken(token: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(
      process.env.ENCRYPTION_KEY || 'default_encryption_key_for_dev_only',
      process.env.ENCRYPTION_SALT || 'default_salt',
      32
    );
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  async getRepositoryById(repositoryId: string): Promise<unknown> {
    const repository = await githubRepositoryRepo.findById(repositoryId);
    if (!repository) {
      throw new AppError('Repository not found', 404, 'REPOSITORY_NOT_FOUND', { repositoryId });
    }
    return {
      id: repository._id.toString(),
      connectionId: repository.connectionId.toString(),
      githubRepoId: repository.githubRepoId,
      owner: repository.owner,
      name: repository.name,
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
      isPrivate: repository.isPrivate,
      lastSyncedAt: repository.lastSyncedAt,
      createdAt: repository.createdAt,
      updatedAt: repository.updatedAt,
    };
  }

  async getUserRepositories(userId: string, pagination = { page: 1, limit: 20 }) {
    // Find all connections for this user
    const connections = await repositoryConnectionRepo.findByUserId(userId);
    const connectionIds = connections.map(c => c._id.toString());

    if (connectionIds.length === 0) {
      return {
        success: true,
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
    }

    // Find all repositories for these connections
    const { data: repositories, total } = await githubRepositoryRepo.findMany(
      { connectionId: { $in: connectionIds.map(id => new mongoose.Types.ObjectId(id)) } },
      { createdAt: -1 },
      { skip: (pagination.page - 1) * pagination.limit, limit: pagination.limit }
    );

    return {
      success: true,
      data: repositories.map(repo => ({
        id: repo._id.toString(),
        connectionId: repo.connectionId.toString(),
        githubRepoId: repo.githubRepoId,
        owner: repo.owner,
        name: repo.name,
        fullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
        isPrivate: repo.isPrivate,
        lastSyncedAt: repo.lastSyncedAt,
        createdAt: repo.createdAt,
        updatedAt: repo.updatedAt,
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async setupWebhook(repositoryId: string, webhookUrl: string): Promise<ApiResponse<{ webhookId: number }>> {
    const repository = await githubRepositoryRepo.findById(repositoryId);
    if (!repository) {
      throw new AppError('Repository not found', 404, 'REPOSITORY_NOT_FOUND', { repositoryId });
    }

    const connection = await repositoryConnectionRepo.findById(repository.connectionId.toString());
    if (!connection) {
      throw new AppError('Connection not found', 404, 'CONNECTION_NOT_FOUND');
    }

    const decryptedToken = await this.decryptToken(connection.tokenEncrypted);
    const apiService = GitHubApiService.createWithToken(decryptedToken);

    // Create webhook with GitHub API
    const webhook = await apiService.createWebhook(repository.owner, repository.name, {
      url: webhookUrl,
      secret: process.env.GITHUB_WEBHOOK_SECRET || 'default_secret',
      events: ['pull_request', 'pull_request_review', 'pull_request_review_comment', 'push'],
      active: true,
    });

    // Update repository with webhook info
    await githubRepositoryRepo.update(repositoryId, {
      webhookId: webhook.id,
      webhookUrl: webhookUrl,
    } as any);

    return {
      success: true,
      data: { webhookId: webhook.id },
      message: 'Webhook configured successfully',
    };
  }

  async decryptToken(encryptedToken: string): Promise<string> {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(
      process.env.ENCRYPTION_KEY || 'default_encryption_key_for_dev_only',
      process.env.ENCRYPTION_SALT || 'default_salt',
      32
    );

    const parts = encryptedToken.split(':');
    if (parts.length !== 3) {
      throw new AppError('Invalid encrypted token format', 400, 'INVALID_TOKEN_FORMAT', {
        retryable: false,
      });
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
