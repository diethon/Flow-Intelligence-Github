import { Request, Response } from 'express';
import { PrDelayPrediction } from '../models/PrDelayPrediction.js';
import { AppError } from '../utils/AppError.js';
import mongoose from 'mongoose';

const RISK_ORDER: Record<string, number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

export class PredictionController {
  async listByRepository(req: Request, res: Response) {
    const repositoryId = String(req.params["repoId"]);
    const riskLabel = req.query["riskLabel"] ? String(req.query["riskLabel"]) : undefined;
    const limit = Math.min(Math.max(Number(req.query["limit"] ?? 50) || 50, 1), 100);
    const page = Math.max(Number(req.query["page"] ?? 1) || 1, 1);
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(repositoryId)) {
      throw new AppError('Invalid repositoryId', 400, 'INVALID_INPUT');
    }

    if (riskLabel && !['Low', 'Medium', 'High'].includes(riskLabel)) {
      throw new AppError('Invalid riskLabel', 400, 'INVALID_INPUT');
    }

    const query: Record<string, unknown> = {
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
    };
    if (riskLabel) {
      query.riskLabel = riskLabel;
    }

    const [predictions, total, allForSummary] = await Promise.all([
      PrDelayPrediction.find(query)
        .populate('pullRequestId', 'number title state authorLogin prUrl additions deletions changedFiles commits createdAt')
        .populate('modelVersionId', 'version algorithm trainedAt')
        .sort({ predictedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PrDelayPrediction.countDocuments(query),
      PrDelayPrediction.find({ repositoryId: new mongoose.Types.ObjectId(repositoryId) })
        .select('riskLabel probability probabilities topFactors predictedAt')
        .lean(),
    ]);

    const riskCounts = { Low: 0, Medium: 0, High: 0 };
    let confidenceTotal = 0;
    let highestRiskLabel: 'Low' | 'Medium' | 'High' | null = null;
    const factorCounts: Record<string, number> = {};

    for (const prediction of allForSummary) {
      riskCounts[prediction.riskLabel] += 1;
      confidenceTotal += prediction.probability || 0;
      if (!highestRiskLabel || RISK_ORDER[prediction.riskLabel] > RISK_ORDER[highestRiskLabel]) {
        highestRiskLabel = prediction.riskLabel;
      }

      const factors = Array.isArray(prediction.topFactors) ? prediction.topFactors : [];
      for (const factor of factors) {
        const name = typeof factor?.factor === 'string' ? factor.factor : undefined;
        if (name) {
          factorCounts[name] = (factorCounts[name] || 0) + 1;
        }
      }
    }

    const topFactors = Object.entries(factorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([factor, count]) => ({ factor, count }));

    res.json({
      success: true,
      data: {
        summary: {
          total: allForSummary.length,
          riskCounts,
          highOrMediumCount: riskCounts.High + riskCounts.Medium,
          averageConfidence: allForSummary.length
            ? Number((confidenceTotal / allForSummary.length).toFixed(4))
            : 0,
          highestRiskLabel,
          topFactors,
          latestPredictedAt: allForSummary
            .map((p) => p.predictedAt)
            .filter(Boolean)
            .sort((a, b) => b.getTime() - a.getTime())[0] || null,
        },
        predictions,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  async getPredictionByPullRequestId(req: Request, res: Response) {
    const repositoryId = String(req.params["repoId"]);
    const pullRequestId = String(req.params["pullRequestId"]);

    if (!mongoose.Types.ObjectId.isValid(repositoryId)) {
      throw new AppError('Invalid repositoryId', 400, 'INVALID_INPUT');
    }

    if (!mongoose.Types.ObjectId.isValid(pullRequestId)) {
      throw new AppError('Invalid pullRequestId', 400, 'INVALID_INPUT');
    }

    const prediction = await PrDelayPrediction.findOne({
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
      pullRequestId: new mongoose.Types.ObjectId(pullRequestId),
    })
      .populate('pullRequestId', 'number title state authorLogin prUrl additions deletions changedFiles commits createdAt')
      .populate('modelVersionId', 'version algorithm trainedAt')
      .lean() as any;

    if (!prediction) {
      throw new AppError('Prediction not found for this pull request', 404, 'NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        pullRequestId: prediction.pullRequestId,
        modelVersionId: prediction.modelVersionId?.version || 'unknown',
        modelVersion: prediction.modelVersionId,
        probability: prediction.probability,
        riskLabel: prediction.riskLabel,
        featureSummary: prediction.featureSummary,
        probabilities: prediction.probabilities,
        topFactors: prediction.topFactors,
        predictedAt: prediction.predictedAt,
      }
    });
  }
}
