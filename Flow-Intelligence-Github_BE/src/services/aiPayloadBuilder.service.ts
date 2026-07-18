import mongoose from "mongoose";
import { EvidenceCard } from "../models/EvidenceCard";
import { MetricSnapshot } from "../models/MetricSnapshot";
import { PrDelayPrediction } from "../models/PrDelayPrediction";
import { PrivacyService } from "./privacy.service";
import { PrivacySettings } from "../models/PrivacySettings";

export class AiPayloadBuilderService {
  constructor(private privacyService: PrivacyService) {}

  public async buildWeeklyBriefPayload(repositoryId: string, windowStart: Date, windowEnd: Date) {
    // 1. Fetch Privacy Settings
    const privacySettings = await PrivacySettings.findOne({
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
    }).lean();

    // 2. Fetch Evidence Cards in the window
    const rawEvidenceCards = await EvidenceCard.find({
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
      createdAt: { $gte: windowStart, $lte: windowEnd },
    }).lean();

    // 3. Query Real Metrics & Predictions
    const metricSnapshots = await MetricSnapshot.find({
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
      computedAt: { $gte: windowStart, $lte: windowEnd },
    }).lean();

    const rawMetrics = metricSnapshots.reduce((acc, curr) => {
      acc[curr.metricKey] = curr.value;
      return acc;
    }, {} as Record<string, any>);

    const delayedPrs = await PrDelayPrediction.countDocuments({
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
      riskLabel: "High",
      predictedAt: { $gte: windowStart, $lte: windowEnd },
    });

    const rawPredictions = {
      delayedPrs,
    };

    const rawLimitations = [
      "AI Service might hallucinate details",
      "Only analyzing data within the specified time window",
    ];

    const rawPayload = {
      metrics: rawMetrics,
      predictions: rawPredictions,
      evidenceCards: rawEvidenceCards.map((c) => ({
        type: c.sourceType,
        severity: c.severity,
        details: c.summary,
      })),
      limitations: rawLimitations,
    };

    // 4. Redact and Pseudonymize based on Privacy Settings
    let finalPayload = this.privacyService.redact(rawPayload);

    if (privacySettings?.pseudonymizeContributors) {
      finalPayload = this.privacyService.pseudonymize(finalPayload);
    }

    return finalPayload;
  }
}
