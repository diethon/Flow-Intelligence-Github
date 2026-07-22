import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { connectDatabase } from "../config/database.js";

// Import models
import { User } from "../models/User.js";
import { GitHubConnection } from "../models/GitHubConnection.js";
import { Repository } from "../models/Repository.js";
import { Contributor } from "../models/Contributor.js";
import { PullRequest } from "../models/PullRequest.js";
import { Review } from "../models/Review.js";
import { CheckRun } from "../models/CheckRun.js";
import { ReviewRequest } from "../models/ReviewRequest.js";
import { SyncRun } from "../models/SyncRun.js";
import { MetricSnapshot } from "../models/MetricSnapshot.js";
import { RiskEvent } from "../models/RiskEvent.js";
import { EvidenceCard } from "../models/EvidenceCard.js";
import { PrDelayPrediction } from "../models/PrDelayPrediction.js";
import { ModelVersion } from "../models/ModelVersion.js";

// Import seeding/analytics functions
import { seedRulebook } from "./seedRulebook.js";
import { calculateUC10Metrics, persistUC10Snapshots } from "../services/metricsEngine.js";
import { calculatePRMetrics, persistPRMetricSnapshots } from "../services/prMetrics.js";
import { evaluateRiskRules } from "../services/riskRuleEngine.js";


// Helper to recursively convert extended JSON format ($oid, $date) to Mongoose-compatible types
function reviveExtendedJson(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(reviveExtendedJson);
  }
  if (typeof obj === "object") {
    if ("$oid" in obj) {
      return new mongoose.Types.ObjectId(obj.$oid);
    }
    if ("$date" in obj) {
      return new Date(obj.$date);
    }
    const revived: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        revived[key] = reviveExtendedJson(obj[key]);
      }
    }
    return revived;
  }
  return obj;
}

// Helper to load and parse fake JSON data
function loadFakeData(filename: string): any {
  const filePath = path.join(__dirname, filename);
  const rawData = fs.readFileSync(filePath, "utf-8");
  return reviveExtendedJson(JSON.parse(rawData));
}

async function runSeeding() {
  try {
    console.log("[Seed] Connecting to MongoDB...");
    await connectDatabase();

    const repoId = "6a302e5040dc9a966cb8dce6";

    // 1. Clear out operational data
    console.log("[Seed] Cleaning existing documents in target collections...");
    await Promise.all([
      User.deleteMany({}),
      GitHubConnection.deleteMany({}),
      Repository.deleteMany({}),
      Contributor.deleteMany({}),
      PullRequest.deleteMany({}),
      Review.deleteMany({}),
      CheckRun.deleteMany({}),
      ReviewRequest.deleteMany({}),
      SyncRun.deleteMany({}),
      MetricSnapshot.deleteMany({}),
      RiskEvent.deleteMany({}),
      EvidenceCard.deleteMany({}),
      PrDelayPrediction.deleteMany({}),
    ]);
    console.log("[Seed] Cleanup completed successfully");

    // 2. Load and insert fake data
    console.log("[Seed] Loading fake JSON datasets...");
    const users = loadFakeData("fake_users.json");
    const connections = loadFakeData("fake_githubConnections.json");
    const repositories = loadFakeData("fake_repositories.json");
    const contributors = loadFakeData("fake_contributors.json");
    const pullRequests = loadFakeData("fake_pullRequests.json");
    const reviews = loadFakeData("fake_reviews.json");
    const checkRuns = loadFakeData("fake_checkRuns.json");
    const reviewRequests = loadFakeData("fake_reviewRequests.json");
    const syncRuns = loadFakeData("fake_syncRuns.json");

    console.log("[Seed] Inserting data to database...");
    await User.insertMany(users);
    await GitHubConnection.insertMany(connections);
    await Repository.insertMany(repositories);
    await Contributor.insertMany(contributors);
    await PullRequest.insertMany(pullRequests);
    await Review.insertMany(reviews);
    await CheckRun.insertMany(checkRuns);
    await ReviewRequest.insertMany(reviewRequests);
    await SyncRun.insertMany(syncRuns);
    console.log("[Seed] Fake JSON seed data inserted successfully");

    // 3. Seed flow rules & recommendations
    console.log("[Seed] Seeding rulebook flow rules and recommendations...");
    await seedRulebook();

    // 4. Calculate and persist metrics / risks on-the-fly for immediate dashboard verification
    console.log("[Seed] Recalculating metrics and flow risks for verification...");
    
    // Calculate review & CI metrics (UC-10)
    const uc10Result = await calculateUC10Metrics(repoId, 7);
    await persistUC10Snapshots(uc10Result);
    console.log("[Seed] Recalculated UC10 metrics successfully");

    // Calculate PR open/stale/oversized metrics (UC-10)
    const prResult = await calculatePRMetrics(repoId, 7);
    await persistPRMetricSnapshots(prResult);
    console.log("[Seed] Recalculated PR metrics successfully");

    // Evaluate delivery flow risks & trigger evidence cards (UC-13, UC-14)
    await evaluateRiskRules(repoId, 7);
    console.log("[Seed] Evaluated Delivery Flow Risk rules successfully");

    // 5. Add some fake PR Delay Predictions
    console.log("[Seed] Seeding fake PR Delay Predictions...");
    
    // Create an available model version to satisfy the orchestrator
    const modelVersion = await ModelVersion.create({
      version: "rf-v1.0.0",
      algorithm: "RandomForestClassifier",
      artifactPath: "dataset/pr-delay-risk.joblib",
      featureSchemaPath: "dataset/feature-schema.json",
      status: "available",
      trainedAt: new Date()
    });
    const prs = await PullRequest.find({ repositoryId: repoId }).limit(2);
    if (prs.length > 0) {
      const predictions = prs.map((pr, index) => ({
        repositoryId: repoId,
        pullRequestId: pr._id,
        modelVersionId: modelVersion._id,
        probability: index === 0 ? 0.85 : 0.20,
        riskLabel: index === 0 ? "High" : "Medium",
        featureSummary: index === 0 
          ? { "additions": 1500, "changed_files": 45, "complexity": 12 }
          : { "additions": 300, "changed_files": 12 },
      }));
      await PrDelayPrediction.insertMany(predictions);
      console.log("[Seed] Inserted fake PR Delay Predictions");
    }

    console.log("[Seed] Seeding process completed successfully! 🎉");
  } catch (err) {
    console.error("[Seed] Critical error encountered during seeding:", err);
  } finally {
    console.log("[Seed] Disconnecting from MongoDB...");
    await mongoose.disconnect();
    console.log("[Seed] Disconnected.");
    process.exit(0);
  }
}

// Run the script
runSeeding();
