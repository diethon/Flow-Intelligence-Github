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

router.get("/repositories/:repoId", validateRepoId, async (req: Request, res: Response) => {
  try {
    const repoId = String(req.params["repoId"]);
    const rawWindowDays = Number(String(req.query["windowDays"] ?? "7"));
    const windowDays = rawWindowDays === 0 ? 0 : Math.min(Math.max(rawWindowDays || 7, 1), 365);

    let startDate: Date | undefined;
    let endDate: Date | undefined;
    if (req.query["startDate"] && req.query["endDate"]) {
      const s = new Date(String(req.query["startDate"]));
      const e = new Date(String(req.query["endDate"]));
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        startDate = s;
        endDate = e;
      }
    }

    const dashboard = await buildDashboard(repoId, windowDays, startDate, endDate);
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
