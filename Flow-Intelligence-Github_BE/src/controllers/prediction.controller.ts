import { Request, Response } from 'express';
import { PrDelayPrediction } from '../models/PrDelayPrediction.js';
import { AppError } from '../utils/AppError.js';
import mongoose from 'mongoose';

export class PredictionController {
  async getPredictionByPullRequestId(req: Request, res: Response) {
    const { pullRequestId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(pullRequestId)) {
      throw new AppError('Invalid pullRequestId', 400);
    }

    const prediction = await PrDelayPrediction.findOne({ pullRequestId })
      .populate('modelVersionId', 'version')
      .lean() as any;

    if (!prediction) {
      throw new AppError('Prediction not found for this pull request', 404);
    }

    res.json({
      success: true,
      data: {
        pullRequestId: prediction.pullRequestId,
        modelVersionId: prediction.modelVersionId?.version || 'unknown',
        probability: prediction.probability,
        riskLabel: prediction.riskLabel,
        featureSummary: prediction.featureSummary,
        predictedAt: prediction.predictedAt,
      }
    });
  }
}
