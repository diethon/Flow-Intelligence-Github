import { Request, Response } from "express";
import { PrivacySettings } from "../models/PrivacySettings";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import mongoose from "mongoose";

export class PrivacyController {
  public getSettings = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    if (!id) {
      throw new AppError("Repository ID is required", 400, "BAD_REQUEST");
    }

    let settings = await PrivacySettings.findOne({
      repositoryId: new mongoose.Types.ObjectId(id),
    }).lean();

    if (!settings) {
      // Return defaults if none exist
      settings = {
        repositoryId: new mongoose.Types.ObjectId(id),
        pseudonymizeContributors: false,
        minimumGroupSize: 3,
        excludeRawComments: true,
        excludeRawCode: true,
      } as any;
    }

    res.json({
      success: true,
      data: settings,
    });
  });

  public updateSettings = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    if (!id) {
      throw new AppError("Repository ID is required", 400, "BAD_REQUEST");
    }

    const { pseudonymizeContributors, minimumGroupSize, excludeRawComments, excludeRawCode } = req.body;

    const updated = await PrivacySettings.findOneAndUpdate(
      { repositoryId: new mongoose.Types.ObjectId(id) },
      {
        $set: {
          pseudonymizeContributors,
          minimumGroupSize,
          excludeRawComments,
          excludeRawCode,
        },
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      data: updated,
    });
  });
}
