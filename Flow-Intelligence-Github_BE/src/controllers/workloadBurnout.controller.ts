import type { Request, Response } from "express";
import { WorkloadBurnoutService, workloadBurnoutService } from "../services/workloadBurnout.service.js";

const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 365;

export class WorkloadBurnoutController {
  constructor(private readonly service: WorkloadBurnoutService = workloadBurnoutService) {}

  /**
   * POST /api/repositories/:id/workload-risk/analyze
   * Accepts an explicit date range (?windowStart=ISO&windowEnd=ISO) — the user
   * picks the dates and clicks Analyze — and falls back to a rolling
   * ?windowDays window (default 7) when no dates are given.
   */
  async analyze(req: Request, res: Response) {
    const repositoryId = req.params.id as string;

    const parsedStart = this.parseDate(req.query.windowStart);
    const parsedEnd = this.parseDate(req.query.windowEnd);

    let windowStart: Date;
    let windowEnd: Date;

    if (parsedStart && parsedEnd) {
      // Explicit range chosen in the UI. Guard against inverted ranges and clamp
      // the span so a huge range can't be used to scan the whole history.
      [windowStart, windowEnd] = parsedStart <= parsedEnd ? [parsedStart, parsedEnd] : [parsedEnd, parsedStart];
      const spanDays = (windowEnd.getTime() - windowStart.getTime()) / (24 * 60 * 60 * 1000);
      if (spanDays > MAX_WINDOW_DAYS) {
        windowStart = new Date(windowEnd.getTime() - MAX_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      }
    } else {
      const rawDays = Number(req.query.windowDays);
      const windowDays =
        Number.isFinite(rawDays) && rawDays > 0 ? Math.min(Math.floor(rawDays), MAX_WINDOW_DAYS) : DEFAULT_WINDOW_DAYS;
      windowEnd = new Date();
      windowStart = new Date(windowEnd.getTime() - windowDays * 24 * 60 * 60 * 1000);
    }

    const result = await this.service.analyze(repositoryId, windowStart, windowEnd);
    res.json({ success: true, data: result });
  }

  /** Parse an ISO date query param; returns null when absent or invalid. */
  private parseDate(raw: unknown): Date | null {
    if (typeof raw !== "string" || raw.trim() === "") return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
}
