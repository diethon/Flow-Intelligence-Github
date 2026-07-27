import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { metricsController } from "../controllers/metrics.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { repoAuthorize } from "../middlewares/repoAuthorize.js";

const router = Router();

// ─── Validate repositoryId middleware ─────────────────────────────────────────
function validateRepoId(req: Request, res: Response, next: () => void): void {
  const repoId = String(req.params["repoId"] ?? "");
  if (!mongoose.Types.ObjectId.isValid(repoId)) {
    res.status(400).json({ error: "Invalid repositoryId" });
    return;
  }
  next();
}

// ─── GET /api/metrics/repositories ───────────────────────────────────────────
// List all repositories (for demo selector)
router.get("/repositories", authenticate, metricsController.getRepositories);

// ─── GET /api/metrics/repositories/:repoId/review-ci ─────────────────────────
// UC-10: Calculate and return review + CI metrics (live calculation, no persistence)
router.get("/repositories/:repoId/review-ci", authenticate, validateRepoId, repoAuthorize(['leader', 'dev', 'viewer']), metricsController.calculateMetrics);

// ─── POST /api/metrics/repositories/:repoId/review-ci/calculate ──────────────
// UC-10: Calculate and PERSIST review + CI metrics to metricSnapshots collection
router.post("/repositories/:repoId/review-ci/calculate", authenticate, validateRepoId, repoAuthorize(['leader']), metricsController.calculateAndPersistMetrics);

// ─── GET /api/metrics/repositories/:repoId/snapshots ─────────────────────────
// Get stored metric snapshots for a repository
router.get("/repositories/:repoId/snapshots", authenticate, validateRepoId, repoAuthorize(['leader', 'dev', 'viewer']), metricsController.getSnapshots);

// ─── GET /api/metrics/repositories/:repoId/review-ci/comparison ──────────────
// UC-10 + E3-S4: Compare current 7d window vs previous 7d window
router.get("/repositories/:repoId/review-ci/comparison", authenticate, validateRepoId, repoAuthorize(['leader', 'dev', 'viewer']), metricsController.getComparison);

export default router;
