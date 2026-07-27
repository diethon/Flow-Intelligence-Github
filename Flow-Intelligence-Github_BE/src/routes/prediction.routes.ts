import { Router } from 'express';
import { PredictionController } from '../controllers/prediction.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middlewares/authenticate.js';
import { repoAuthorize } from '../middlewares/repoAuthorize.js';

export function createPredictionRouter(): Router {
  const router = Router({ mergeParams: true });
  const controller = new PredictionController();

  router.get(
    '/:repoId/predictions',
    authenticate,
    repoAuthorize(['leader', 'dev', 'viewer']),
    asyncHandler((req, res) => controller.listByRepository(req, res))
  );

  router.get(
    '/:repoId/predictions/:pullRequestId',
    authenticate,
    repoAuthorize(['leader', 'dev', 'viewer']),
    asyncHandler((req, res) => controller.getPredictionByPullRequestId(req, res))
  );

  return router;
}
