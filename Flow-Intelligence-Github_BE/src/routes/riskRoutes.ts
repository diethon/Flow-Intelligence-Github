import { Router, type Request, type Response } from "express";
import { evaluateRiskRules, getLatestRiskEvents } from "../services/riskRuleEngine.js";
import { Repository } from "../models/Repository.js";

const router = Router();

/**
 * GET /api/risk/repositories/:repoId/events
 * Returns the most recently stored risk events (no recalculation).
 */
router.get("/repositories/:repoId/events", async (req: Request, res: Response) => {
  try {
    const repoId     = String(req.params["repoId"]);
    const rawWindowDays = Number(req.query["windowDays"]);
    const windowDays = rawWindowDays === 0 ? 0 : (rawWindowDays || 7);

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

    const result     = await getLatestRiskEvents(repoId, windowDays, startDate, endDate);
    if (!result) {
      return res.json({
        success: true,
        data: null,
        message: "No risk events found. Run /evaluate to compute them.",
      });
    }
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch risk events", detail: String(err) });
  }
});

/**
 * POST /api/risk/repositories/:repoId/evaluate
 * Runs the full risk rule evaluation (R1–R5), persists RiskEvents + EvidenceCards,
 * and returns the fresh result.
 */
router.post("/repositories/:repoId/evaluate", async (req: Request, res: Response) => {
  try {
    const repoId     = String(req.params["repoId"]);
    const rawWindowDays = Number(req.body?.windowDays ?? req.query["windowDays"]);
    const windowDays = rawWindowDays === 0 ? 0 : (rawWindowDays || 7);

    const repo = await Repository.findById(repoId);
    if (!repo) return res.status(404).json({ error: "Repository not found" });

    let startDate: Date | undefined;
    let endDate: Date | undefined;
    if (req.body?.startDate && req.body?.endDate) {
      const s = new Date(String(req.body.startDate));
      const e = new Date(String(req.body.endDate));
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        startDate = s;
        endDate = e;
      }
    }

    const result = await evaluateRiskRules(repoId, windowDays, startDate, endDate);
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ error: "Risk evaluation failed", detail: String(err) });
  }
});

export default router;
