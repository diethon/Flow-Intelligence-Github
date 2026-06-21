import { type Request, type Response } from "express";
import mongoose from "mongoose";
import { Repository } from "../models/Repository.js";
import { buildDashboard, getRulebook } from "../services/dashboardService.js";

export class DashboardController {
  
  // GET /api/dashboard/repositories
  async getRepositories(_req: Request, res: Response): Promise<void> {
    try {
      const repos = await Repository.find()
        .select("_id owner name fullName lastSyncedAt isPrivate")
        .lean();
      res.json({ success: true, data: repos });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch repositories", detail: String(err) });
    }
  }

  // GET /api/dashboard/repositories/:repoId
  async getDashboard(req: Request, res: Response): Promise<void> {
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
  }

  // GET /api/dashboard/rulebook
  async getRulebook(_req: Request, res: Response): Promise<void> {
    try {
      const rulebook = await getRulebook();
      res.json({ success: true, data: rulebook });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch rulebook", detail: String(err) });
    }
  }

  // GET /api/dashboard/rulebook/:ruleCode
  async getRuleDetails(req: Request, res: Response): Promise<void> {
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
  }
}

export const dashboardController = new DashboardController();
