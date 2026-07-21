jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    request: jest.fn(),
  })),
}));

import request from 'supertest';
import app from '../../src/server';

describe('GitHub API Integration', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/github/connect', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/github/connect')
        .send({
          token: 'github-token',
          owner: 'facebook',
          repo: 'react',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/repositories/:id/sync', () => {
    it('should require authentication', async () => {
      const response = await request(app).post('/api/repositories/123/sync').send({});

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/repositories/:id/sync-status', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/api/repositories/123/sync-status');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/webhooks/github', () => {
    it('should require signature', async () => {
      const response = await request(app)
        .post('/api/webhooks/github')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
