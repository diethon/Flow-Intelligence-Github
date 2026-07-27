import { Router } from 'express';
import type { EvidenceController } from '../controllers/evidence.controller';
import { authenticate } from '../middlewares/authenticate';
import { repoAuthorize } from '../middlewares/repoAuthorize';
import { asyncHandler } from '../utils/asyncHandler';

/** Repository-scoped evidence routes, mounted at /api/repositories */
export const createRepositoryEvidenceRoutes = (controller: EvidenceController): Router => {
  const router = Router();

  router.get(
    '/:repoId/evidence-cards',
    authenticate,
    repoAuthorize(['leader', 'dev', 'viewer']),
    asyncHandler((req, res) => controller.listByRepository(req, res))
  );
  router.post(
    '/:repoId/evidence-cards/from-risk-event',
    authenticate,
    repoAuthorize(['leader', 'dev']),
    asyncHandler((req, res) => controller.generateFromRiskEvent(req, res))
  );
  router.post(
    '/:repoId/evidence-cards/from-prediction',
    authenticate,
    repoAuthorize(['leader', 'dev']),
    asyncHandler((req, res) => controller.generateFromPrediction(req, res))
  );

  return router;
};

/** Evidence Card detail routes, mounted at /api/evidence-cards */
export const createEvidenceCardRoutes = (controller: EvidenceController): Router => {
  const router = Router();

  router.get(
    '/:id',
    authenticate,
    asyncHandler((req, res) => controller.getById(req, res))
  );

  return router;
};
