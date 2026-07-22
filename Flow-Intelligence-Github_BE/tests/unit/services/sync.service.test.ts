import { SyncService } from '../../../src/modules/github/services/sync.service';
import { GitHubApiService } from '../../../src/modules/github/services/githubApi.service';

describe('SyncService', () => {
  let syncService: SyncService;
  let githubApiService: jest.Mocked<GitHubApiService>;

  beforeEach(() => {
    githubApiService = {
      validateToken: jest.fn(),
      getRepository: jest.fn(),
      getPullRequests: jest.fn(),
      getReviews: jest.fn(),
      getReviewRequests: jest.fn(),
    } as unknown as jest.Mocked<GitHubApiService>;

    syncService = new SyncService(githubApiService);
  });

  describe('getSyncStatus', () => {
    it('should throw if repository not found', async () => {
      const mockReq = {
        params: { id: 'non-existing' },
      };

      await expect(syncService.getSyncStatus('non-existing')).rejects.toThrow();
    });
  });
});
