import { Request, Response } from "express";
import { PrivacySettings } from "../models/PrivacySettings";
import { PullRequest } from "../models/PullRequest";
import { Review } from "../models/Review";
import { Commit } from "../models/Commit";
import { CheckRun } from "../models/CheckRun";
import { MetricSnapshot } from "../models/MetricSnapshot";
import { RiskEvent } from "../models/RiskEvent";
import { EvidenceCard } from "../models/EvidenceCard";
import { AiBrief } from "../models/AiBrief";
import { PrDelayPrediction } from "../models/PrDelayPrediction";
import { SyncRun } from "../models/SyncRun";
import { DataQualityWarning } from "../models/DataQualityWarning";
import { Contributor } from "../models/Contributor";
import { AuditEvent } from "../models/AuditEvent";
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

    console.log(`\n🔒 [PRIVACY SETTINGS TOGGLED] Repo ID: ${id}`);
    console.log(`   ├─ Pseudonymize Contributors: ${pseudonymizeContributors ? "🟢 ON (ENABLED)" : "🔴 OFF (DISABLED)"}`);
    console.log(`   ├─ Minimum Group Size:        ${minimumGroupSize} members`);
    console.log(`   ├─ Exclude Raw Comments:     ${excludeRawComments ? "🟢 ON (ENABLED)" : "🔴 OFF (DISABLED)"}`);
    console.log(`   └─ Exclude Raw Code Diffs:   ${excludeRawCode ? "🟢 ON (ENABLED)" : "🔴 OFF (DISABLED)"}\n`);

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

    // Audit log setting update
    try {
      await AuditEvent.create({
        action: "PRIVACY_SETTINGS_UPDATED",
        repositoryId: new mongoose.Types.ObjectId(id),
        details: { pseudonymizeContributors, minimumGroupSize, excludeRawComments, excludeRawCode },
      });
    } catch (e) {
      // Non-blocking audit error
    }

    res.json({
      success: true,
      data: updated,
    });
  });

  public deleteData = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    if (!id) {
      throw new AppError("Repository ID is required", 400, "BAD_REQUEST");
    }

    const repoObjectId = new mongoose.Types.ObjectId(id);

    // Purge all analytics & synced entities for this repository
    await Promise.all([
      PullRequest.deleteMany({ repositoryId: repoObjectId }),
      Review.deleteMany({ repositoryId: repoObjectId }),
      Commit.deleteMany({ repositoryId: repoObjectId }),
      CheckRun.deleteMany({ repositoryId: repoObjectId }),
      MetricSnapshot.deleteMany({ repositoryId: repoObjectId }),
      RiskEvent.deleteMany({ repositoryId: repoObjectId }),
      EvidenceCard.deleteMany({ repositoryId: repoObjectId }),
      AiBrief.deleteMany({ repositoryId: repoObjectId }),
      PrDelayPrediction.deleteMany({ repositoryId: repoObjectId }),
      SyncRun.deleteMany({ repositoryId: repoObjectId }),
      DataQualityWarning.deleteMany({ repositoryId: repoObjectId }),
      Contributor.deleteMany({ repositoryId: repoObjectId }),
    ]);

    // Audit log data deletion
    try {
      await AuditEvent.create({
        action: "DATA_PURGED",
        repositoryId: repoObjectId,
        details: { message: "All synced analytics records purged via Privacy Settings request." },
      });
    } catch (e) {
      // Non-blocking audit error
    }

    res.json({
      success: true,
      message: "All repository data and analytics records have been successfully purged.",
    });
  });
}

