import { Router } from "express";
import type { WorkloadBurnoutController } from "../controllers/workloadBurnout.controller";
import { authenticate } from "../middlewares/authenticate";
import { asyncHandler } from "../utils/asyncHandler";

/** Repository-scoped Workload Risk (burnout) routes, mounted at /api/repositories */
export const createWorkloadBurnoutRoutes = (controller: WorkloadBurnoutController): Router => {
  const router = Router();

  router.post(
    "/:id/workload-risk/analyze",
    authenticate,
    asyncHandler((req, res) => controller.analyze(req, res))
  );

  return router;
};
