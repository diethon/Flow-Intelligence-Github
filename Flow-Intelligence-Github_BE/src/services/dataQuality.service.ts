import mongoose from "mongoose";
import { DataQualityWarning } from "../models/DataQualityWarning";
import { SyncRun } from "../models/SyncRun";

export class DataQualityService {
  /**
   * Evaluates synchronization quality for a given repository.
   */
  public async evaluateQuality(repositoryId: string) {
    const warnings = await DataQualityWarning.find({
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
      resolvedAt: null,
    }).lean();

    const lastSync = await SyncRun.findOne({
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
      status: "success",
    })
      .sort({ completedAt: -1 })
      .lean();

    let score = 100;
    const missingData: string[] = [];

    let hasError = false;
    let hasWarning = false;

    warnings.forEach((w) => {
      if (w.severity === "error") {
        score -= 20;
        hasError = true;
      } else if (w.severity === "warning") {
        score -= 10;
        hasWarning = true;
      } else {
        score -= 2; // info
      }

      if (w.affectedMetric && !missingData.includes(w.affectedMetric)) {
        missingData.push(w.affectedMetric);
      }
    });

    if (score < 0) score = 0;

    let status: "GOOD" | "PARTIAL" | "POOR" = "GOOD";
    if (score < 50 || hasError) {
      status = "POOR";
    } else if (score < 90 || hasWarning) {
      status = "PARTIAL";
    }

    return {
      score,
      status,
      missingData,
      lastSync: lastSync?.completedAt || null,
    };
  }
}
