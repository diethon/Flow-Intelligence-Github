import { Request, Response } from "express";
import { BriefService } from "../services/brief.service";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";

export class BriefController {
  constructor(private briefService: BriefService) {}

  public generateBrief = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    if (!id) {
      throw new AppError("Repository ID is required", 400, "BAD_REQUEST");
    }

    const { windowStart, windowEnd } = req.body;
    
    const start = windowStart ? new Date(windowStart) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = windowEnd ? new Date(windowEnd) : new Date();

    const brief = await this.briefService.generateBrief(id, start, end);

    res.json({
      success: true,
      data: brief,
    });
  });

  public getBriefs = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    if (!id) {
      throw new AppError("Repository ID is required", 400, "BAD_REQUEST");
    }

    const briefs = await this.briefService.getBriefs(id);

    res.json({
      success: true,
      data: briefs,
    });
  });
}
