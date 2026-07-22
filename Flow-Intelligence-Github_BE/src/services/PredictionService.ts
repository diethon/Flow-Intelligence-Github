import { spawn } from "child_process";
import path from "path";
import { PullRequest } from "../models/PullRequest";
import { PrDelayPrediction, RiskLabel } from "../models/PrDelayPrediction";
import { ModelVersion } from "../models/ModelVersion";
import { PredictionResult } from "../dto/prediction.dto";

export class PredictionService {
  private static readonly INFERENCE_SCRIPT = path.join(__dirname, "../../../dataset/inference.py");

  /**
   * Calls the Python inference script to predict delay risk.
   */
  private static async callInference(features: Record<string, number>): Promise<{ probability: number; riskLabel: RiskLabel }> {
    return new Promise((resolve, reject) => {
      const process = spawn("python", [this.INFERENCE_SCRIPT], {
        cwd: path.join(__dirname, "../../../dataset")
      });

      let output = "";
      let errorOutput = "";

      process.stdout.on("data", (data) => {
        output += data.toString();
      });

      process.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      process.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Inference script exited with code ${code}. Error: ${errorOutput}`));
          return;
        }

        try {
          const result = JSON.parse(output.trim());
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(new Error("Failed to parse inference output: " + output));
        }
      });

      process.stdin.write(JSON.stringify(features));
      process.stdin.end();
    });
  }

  /**
   * Predicts PR delay risk and saves it to the database.
   */
  public static async predictAndSave(repositoryId: string, pullRequestId: string): Promise<PredictionResult> {
    const pr = await PullRequest.findById(pullRequestId);
    if (!pr) throw new Error("PullRequest not found");

    // Fetch the latest available model
    const model = await ModelVersion.findOne({ status: "available" }).sort({ trainedAt: -1 });
    if (!model) throw new Error("No available model found");

    const features = {
      changed_files: pr.changedFiles || 0,
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      commits: pr.commits || 1, // Default 1 if null to avoid empty commits
    };

    const inferenceResult = await this.callInference(features);

    // Save prediction
    const prediction = await PrDelayPrediction.findOneAndUpdate(
      { pullRequestId: pr._id, modelVersionId: model._id },
      {
        repositoryId,
        probability: inferenceResult.probability,
        riskLabel: inferenceResult.riskLabel,
        featureSummary: features,
        predictedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return {
      predictionId: prediction._id.toString(),
      pullRequestId: pr._id.toString(),
      modelVersionId: model._id.toString(),
      probability: prediction.probability,
      riskLabel: prediction.riskLabel,
      featureSummary: prediction.featureSummary,
      predictedAt: prediction.predictedAt,
    };
  }
}
