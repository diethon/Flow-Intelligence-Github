import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { dashboardController } from "../controllers/dashboard.controller.js";
import { authenticate } from "../middlewares/authenticate.js";

const router = Router();

function validateRepoId(req: Request, res: Response, next: () => void): void {
  const repoId = String(req.params["repoId"] ?? "");
  if (!mongoose.Types.ObjectId.isValid(repoId)) {
    res.status(400).json({ error: "Invalid repositoryId" });
    return;
  }
  next();
}

// ─── GET /api/dashboard/repositories ─────────────────────────────────────────
router.get("/repositories", authenticate, dashboardController.getRepositories);

router.get("/repositories/:repoId", authenticate, validateRepoId, dashboardController.getDashboard);

// ─── GET /api/dashboard/rulebook ─────────────────────────────────────────────
// UC-14: Flow Risk Rulebook with recommendations
router.get("/rulebook", dashboardController.getRulebook);

// ─── GET /api/dashboard/rulebook/:ruleCode ────────────────────────────────────
// UC-14: Single rule detail
router.get("/rulebook/:ruleCode", dashboardController.getRuleDetails);

export default router;
