import type { Router } from 'express';
import type { GitHubController } from '../controllers/github.controller';
import type { WebhookService } from '../services';
import { authenticate } from '../../../middlewares/authenticate';
import { validateWebhookSignature } from '../../../middlewares/validateWebhookSignature';

export const createGitHubRoutes = (controller: GitHubController): Router => {
  const router = require('express').Router();

  router.post('/connect', authenticate, (req: any, res: any) => controller.connectRepository(req, res));
  router.delete('/disconnect/:repositoryId', authenticate, (req: any, res: any) => controller.disconnectRepository(req, res));
  router.get('/status', authenticate, (req: any, res: any) => controller.getConnectionStatus(req, res));
  router.get('/sync/:repositoryId', authenticate, (req: any, res: any) => controller.getSyncStatus(req, res));
  router.post('/validate-token', authenticate, (req: any, res: any) => controller.validateToken(req, res));
  router.get('/repositories', authenticate, (req: any, res: any) => controller.getRepositories(req, res));
  router.get('/repositories/suggested', authenticate, (req: any, res: any) => controller.getSuggestedRepositories(req, res));
  router.get('/repositories/:id', authenticate, (req: any, res: any) => controller.getRepositoryById(req, res));
  router.get('/repositories/:id/details', authenticate, (req: any, res: any) => controller.getRepositoryDetails(req, res));

  return router;
};

export const createRepositoryRoutes = (controller: GitHubController): Router => {
  const router = require('express').Router();

  router.post('/:id/sync', authenticate, (req: any, res: any) => controller.triggerSync(req, res));
  router.get('/:id/sync-status', authenticate, (req: any, res: any) => controller.getSyncStatusSummary(req, res));
  router.get('/:id/sync-runs', authenticate, (req: any, res: any) => controller.getSyncRuns(req, res));
  router.get('/:id/webhooks', authenticate, (req: any, res: any) => controller.getWebhookEvents(req, res));
  router.get('/:id/webhooks/:eventId', authenticate, (req: any, res: any) => controller.getWebhookEventDetail(req, res));
  router.post('/:id/webhooks/:eventId/retry', authenticate, (req: any, res: any) => controller.retryWebhookEvent(req, res));
  router.post('/:id/webhooks/setup', authenticate, (req: any, res: any) => controller.setupWebhook(req, res));
  router.get('/:id/pull-requests', authenticate, (req: any, res: any) => controller.getPullRequests(req, res));

  return router;
};

export const createWebhookRoutes = (_webhookService: WebhookService): Router => {
  const router = require('express').Router();

  router.post('/github', validateWebhookSignature, (req: any, res: any) => {
    res.json({ success: true, message: 'Webhook received' });
  });

  return router;
};
