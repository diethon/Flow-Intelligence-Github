import { Request, Response } from "express";
import { DataQualityService } from "../services/dataQuality.service";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";

export class DataQualityController {
  constructor(private dataQualityService: DataQualityService) {}

  public getQuality = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    if (!id) {
      throw new AppError("Repository ID is required", 400, "BAD_REQUEST");
    }

    const quality = await this.dataQualityService.evaluateQuality(id);

    res.json({
      success: true,
      data: quality,
    });
  });
}
