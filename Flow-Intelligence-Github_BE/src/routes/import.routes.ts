import { Router } from 'express';
import type { ImportController } from '../controllers/import.controller';
import { authenticate } from '../middlewares/authenticate';
import { asyncHandler } from '../utils/asyncHandler';

/** Import routes, mounted at /api/repositories */
export const createImportRoutes = (controller: ImportController): Router => {
  const router = Router();

  router.post(
    '/:id/import',
    authenticate,
    asyncHandler((req, res) => controller.importJson(req, res))
  );

  // CSV import for a single entity type: POST /:id/import/csv?entity=issues
  // with Content-Type: text/csv and the raw CSV file as the request body.
  router.post(
    '/:id/import/csv',
    authenticate,
    asyncHandler((req, res) => controller.importCsv(req, res))
  );

  return router;
};
