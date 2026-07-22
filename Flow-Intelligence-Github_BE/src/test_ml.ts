import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { PullRequest } from "./models/index.js";
import { ModelVersion } from "./models/index.js";
import { PredictionService } from "./services/PredictionService.js";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function runTest() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/flow_intelligence");
    console.log("Connected to DB");

    let model = await ModelVersion.findOne({ status: "available" });
    if (!model) {
      console.log("No ModelVersion found. Creating a fake one...");
      model = await ModelVersion.create({
        version: "rf-v1.0.0-test",
        algorithm: "RandomForestClassifier",
        artifactPath: "dataset/pr-delay-risk.joblib",
        featureSchemaPath: "dataset/feature-schema.json",
        status: "available",
        trainedAt: new Date()
      });
    }

    const pr = await PullRequest.findOne({ state: "open" });
    if (!pr) {
      console.log("No OPEN PullRequests found in DB. Searching for any PR...");
      const anyPr = await PullRequest.findOne();
      if (!anyPr) {
        console.log("No PullRequests in DB at all.");
        process.exit(1);
      }
      
      console.log(`Testing prediction on ANY PR: ${anyPr.number}`);
      const pred = await PredictionService.predictAndSave(anyPr.repositoryId.toString(), anyPr._id.toString());
      console.log("Prediction success:", pred);
    } else {
      console.log(`Testing prediction on OPEN PR: ${pr.number}`);
      const pred = await PredictionService.predictAndSave(pr.repositoryId.toString(), pr._id.toString());
      console.log("Prediction success:", pred);
    }

    process.exit(0);
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

runTest();
