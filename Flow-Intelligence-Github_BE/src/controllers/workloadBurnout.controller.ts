import type { Request, Response } from "express";
import { WorkloadBurnoutService, workloadBurnoutService } from "../services/workloadBurnout.service.js";

const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 90;

export class WorkloadBurnoutController {
  constructor(private readonly service: WorkloadBurnoutService = workloadBurnoutService) {}

  /** POST /api/repositories/:id/workload-risk/analyze?windowDays=7 */
  async analyze(req: Request, res: Response) {
    const repositoryId = req.params.id as string;

    const rawDays = Number(req.query.windowDays);
    const windowDays =
      Number.isFinite(rawDays) && rawDays > 0 ? Math.min(Math.floor(rawDays), MAX_WINDOW_DAYS) : DEFAULT_WINDOW_DAYS;

    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const result = await this.service.analyze(repositoryId, windowStart, windowEnd);
    res.json({ success: true, data: result });
  }
}
