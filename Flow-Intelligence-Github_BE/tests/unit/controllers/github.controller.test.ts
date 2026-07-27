jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    request: jest.fn(),
  })),
}));

import { GitHubController } from '../../../src/modules/github/controllers/github.controller';
import { GitHubConnectionService } from '../../../src/modules/github/services/githubConnection.service';
import { SyncService } from '../../../src/modules/github/services/sync.service';
import { GitHubApiService } from '../../../src/modules/github/services/githubApi.service';
import { User } from '../../../src/modules/auth/models';

jest.mock('../../../src/modules/auth/models', () => ({
  User: {
    findById: jest.fn(),
  },
}));

describe('GitHubController', () => {
  let controller: GitHubController;
  let connectionService: jest.Mocked<GitHubConnectionService>;
  let syncService: jest.Mocked<SyncService>;
  let githubApiService: jest.Mocked<GitHubApiService>;

  beforeEach(() => {
    (User.findById as jest.Mock).mockResolvedValue({
      _id: 'user_1',
      accessToken: 'github-token',
    });

    connectionService = {
      connectRepository: jest.fn(),
      disconnectRepository: jest.fn(),
      getConnectionStatus: jest.fn(),
    } as unknown as jest.Mocked<GitHubConnectionService>;

    syncService = {
      triggerSync: jest.fn(),
      getSyncStatus: jest.fn(),
      cleanupStuckSyncs: jest.fn().mockResolvedValue(undefined),
      getSyncStatusById: jest.fn().mockResolvedValue({ syncStatus: {} }),
    } as unknown as jest.Mocked<SyncService>;

    githubApiService = {
      validateToken: jest.fn(),
      getRepository: jest.fn(),
      getPullRequests: jest.fn(),
      getReviews: jest.fn(),
      getReviewRequests: jest.fn(),
    } as unknown as jest.Mocked<GitHubApiService>;

    controller = new GitHubController(connectionService, syncService, githubApiService);
  });

  describe('connectRepository', () => {
    it('should call connection service and return response', async () => {
      const mockResult = {
        success: true,
        data: {
          repository: {
            id: 'repo_1',
            connectionId: 'conn_1',
            githubRepoId: 123,
            owner: 'facebook',
            name: 'react',
            fullName: 'facebook/react',
            defaultBranch: 'main',
            isPrivate: false,
          },
          connectionId: 'conn_1',
        },
        message: 'Repository connected successfully',
      };

      connectionService.connectRepository.mockResolvedValue(mockResult as never);

      const req = {
        userId: 'user_1',
        body: {
          token: 'github-token',
          owner: 'facebook',
          repo: 'react',
        },
        params: {},
        query: {},
        headers: {},
      } as unknown as Parameters<typeof controller.connectRepository>[0];

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Parameters<typeof controller.connectRepository>[1];

      const next = jest.fn();

      await controller.connectRepository(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('triggerSync', () => {
    it('should call sync service and return accepted', async () => {
      const mockResult = {
        success: true,
        data: {
          syncRunId: 'run_1',
          jobsEnqueued: ['sync_pull_requests'],
        },
        message: 'Sync initiated successfully',
      };

      syncService.triggerSync.mockResolvedValue(mockResult as never);

      const req = {
        body: {},
        params: { id: 'repo_1' },
        query: {},
        headers: {},
      } as unknown as Parameters<typeof controller.triggerSync>[0];

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Parameters<typeof controller.triggerSync>[1];

      const next = jest.fn();

      await controller.triggerSync(req, res, next);

      expect(syncService.triggerSync).toHaveBeenCalledWith('repo_1', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
  });
});
