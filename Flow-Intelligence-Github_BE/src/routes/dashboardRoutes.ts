import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { Repository } from "../models/Repository.js";
import { buildDashboard, getRulebook } from "../services/dashboardService.js";

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
router.get("/repositories", async (_req: Request, res: Response) => {
  try {
    const repos = await Repository.find()
      .select("_id owner name fullName lastSyncedAt isPrivate")
      .lean();
    res.json({ success: true, data: repos });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch repositories", detail: String(err) });
  }
});

// ─── GET /api/dashboard/repositories/:repoId ─────────────────────────────────
// UC-11 + UC-12: Full dashboard summary — KPIs, risk level, bottlenecks
router.get("/repositories/:repoId", validateRepoId, async (req: Request, res: Response) => {
  try {
    const repoId = String(req.params["repoId"]);
    const windowDays = Math.min(Math.max(Number(String(req.query["windowDays"] ?? "7")) || 7, 1), 90);

    const dashboard = await buildDashboard(repoId, windowDays);
    res.json({ success: true, data: dashboard });
  } catch (err) {
    res.status(500).json({ error: "Failed to build dashboard", detail: String(err) });
  }
});

// ─── GET /api/dashboard/rulebook ─────────────────────────────────────────────
// UC-14: Flow Risk Rulebook with recommendations
router.get("/rulebook", async (_req: Request, res: Response) => {
  try {
    const rulebook = await getRulebook();
    res.json({ success: true, data: rulebook });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch rulebook", detail: String(err) });
  }
});

// ─── GET /api/dashboard/rulebook/:ruleCode ────────────────────────────────────
// UC-14: Single rule detail
router.get("/rulebook/:ruleCode", async (req: Request, res: Response) => {
  try {
    const ruleCode = String(req.params["ruleCode"]).toUpperCase();
    const rulebook = await getRulebook();
    const rule = rulebook.find((r) => r.ruleCode === ruleCode);
    if (!rule) {
      res.status(404).json({ error: `Rule ${ruleCode} not found` });
      return;
    }
    res.json({ success: true, data: rule });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch rule", detail: String(err) });
  }
});

export default router;
