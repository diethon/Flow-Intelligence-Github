import { Router } from 'express';
import { PredictionController } from '../controllers/prediction.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export function createPredictionRouter(): Router {
  const router = Router({ mergeParams: true });
  const controller = new PredictionController();

  router.get('/:pullRequestId', asyncHandler((req, res) => controller.getPredictionByPullRequestId(req, res)));

  return router;
}
