import { GitHubApiService } from '../../src/modules/github/services/githubApi.service';

describe('GitHubApiService', () => {
  const service = new GitHubApiService({ token: 'test-token' });

  describe('validateToken', () => {
    it('should be implemented', () => {
      expect(typeof service.validateToken).toBe('function');
    });
  });

  describe('getRepository', () => {
    it('should be implemented', () => {
      expect(typeof service.getRepository).toBe('function');
    });
  });

  describe('getPullRequests', () => {
    it('should be implemented', () => {
      expect(typeof service.getPullRequests).toBe('function');
    });
  });

  describe('getReviews', () => {
    it('should be implemented', () => {
      expect(typeof service.getReviews).toBe('function');
    });
  });

  describe('getReviewRequests', () => {
    it('should be implemented', () => {
      expect(typeof service.getReviewRequests).toBe('function');
    });
  });
});
