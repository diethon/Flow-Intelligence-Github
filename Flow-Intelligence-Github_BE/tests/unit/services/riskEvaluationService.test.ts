import { describe, expect, it } from "@jest/globals";
import mongoose from "mongoose";
import { RiskRuleEngine } from "../../../src/services/riskRuleEngine";
import { IPullRequest } from "../../../src/models/PullRequest";
import { IReview } from "../../../src/models/Review";
import { ICheckRun } from "../../../src/models/CheckRun";

describe("RiskRuleEngine (UC-13)", () => {
  const now = new Date("2026-06-20T12:00:00.000Z");

  describe("R1 - Stale PR Risk", () => {
    it("should trigger High severity risk if PR is open for > 7 days", () => {
      const openPRs = [
        {
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date("2026-06-10T12:00:00.000Z"), // 10 days ago
        } as IPullRequest,
      ];
      const result = RiskRuleEngine.evaluateR1(openPRs, now);
      expect(result.isTriggered).toBe(true);
      expect(result.severity).toBe("high");
      expect(result.metricValue).toBe(10);
      expect(result.thresholdValue).toBe(7);
      expect(result.affectedEntityRefs).toHaveLength(1);
    });

    it("should trigger Medium severity risk if PR is open for > 3 days but <= 7 days", () => {
      const openPRs = [
        {
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date("2026-06-16T12:00:00.000Z"), // 4 days ago
        } as IPullRequest,
      ];
      const result = RiskRuleEngine.evaluateR1(openPRs, now);
      expect(result.isTriggered).toBe(true);
      expect(result.severity).toBe("medium");
      expect(result.metricValue).toBe(4);
      expect(result.thresholdValue).toBe(3);
      expect(result.affectedEntityRefs).toHaveLength(1);
    });

    it("should not trigger risk if PR age is <= 3 days", () => {
      const openPRs = [
        {
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date("2026-06-19T12:00:00.000Z"), // 1 day ago
        } as IPullRequest,
      ];
      const result = RiskRuleEngine.evaluateR1(openPRs, now);
      expect(result.isTriggered).toBe(false);
      expect(result.severity).toBe("low");
      expect(result.metricValue).toBe(1);
      expect(result.affectedEntityRefs).toHaveLength(0);
    });
  });

  describe("R2 - Review Pickup Risk", () => {
    it("should trigger High severity risk if avg pickup is > 48 hours", () => {
      const prsWithPickup = [
        { prId: new mongoose.Types.ObjectId(), pickupHours: 50 },
      ];
      const result = RiskRuleEngine.evaluateR2(prsWithPickup);
      expect(result.isTriggered).toBe(true);
      expect(result.severity).toBe("high");
      expect(result.metricValue).toBe(50);
      expect(result.thresholdValue).toBe(48);
      expect(result.affectedEntityRefs).toHaveLength(1);
    });

    it("should trigger Medium severity risk if avg pickup is > 24 hours but <= 48 hours", () => {
      const prsWithPickup = [
        { prId: new mongoose.Types.ObjectId(), pickupHours: 30 },
      ];
      const result = RiskRuleEngine.evaluateR2(prsWithPickup);
      expect(result.isTriggered).toBe(true);
      expect(result.severity).toBe("medium");
      expect(result.metricValue).toBe(30);
      expect(result.thresholdValue).toBe(24);
      expect(result.affectedEntityRefs).toHaveLength(1);
    });

    it("should not trigger risk if avg pickup is <= 24 hours", () => {
      const prsWithPickup = [
        { prId: new mongoose.Types.ObjectId(), pickupHours: 12 },
      ];
      const result = RiskRuleEngine.evaluateR2(prsWithPickup);
      expect(result.isTriggered).toBe(false);
      expect(result.severity).toBe("low");
      expect(result.metricValue).toBe(12);
      expect(result.affectedEntityRefs).toHaveLength(0);
    });
  });

  describe("R3 - Reviewer Concentration Risk", () => {
    it("should trigger High severity risk if reviewer share is > 70%", () => {
      const reviewerId1 = new mongoose.Types.ObjectId();
      const reviewerId2 = new mongoose.Types.ObjectId();
      const reviews = [
        { reviewerId: reviewerId1 } as IReview,
        { reviewerId: reviewerId1 } as IReview,
        { reviewerId: reviewerId1 } as IReview,
        { reviewerId: reviewerId2 } as IReview, // reviewerId1 has 3/4 = 75%
      ];
      const result = RiskRuleEngine.evaluateR3(reviews);
      expect(result.isTriggered).toBe(true);
      expect(result.severity).toBe("high");
      expect(result.metricValue).toBe(75);
      expect(result.thresholdValue).toBe(70);
      expect(result.affectedEntityRefs).toHaveLength(3);
    });

    it("should trigger Medium severity risk if reviewer share is > 50% but <= 70%", () => {
      const reviewerId1 = new mongoose.Types.ObjectId();
      const reviewerId2 = new mongoose.Types.ObjectId();
      const reviews = [
        { reviewerId: reviewerId1 } as IReview,
        { reviewerId: reviewerId1 } as IReview,
        { reviewerId: reviewerId2 } as IReview, // reviewerId1 has 2/3 = 66.7%
      ];
      const result = RiskRuleEngine.evaluateR3(reviews);
      expect(result.isTriggered).toBe(true);
      expect(result.severity).toBe("medium");
      expect(result.metricValue).toBe(66.7);
      expect(result.thresholdValue).toBe(50);
      expect(result.affectedEntityRefs).toHaveLength(2);
    });

    it("should not trigger risk if reviewer share is <= 50%", () => {
      const reviewerId1 = new mongoose.Types.ObjectId();
      const reviewerId2 = new mongoose.Types.ObjectId();
      const reviews = [
        { reviewerId: reviewerId1 } as IReview,
        { reviewerId: reviewerId2 } as IReview, // 50% each
      ];
      const result = RiskRuleEngine.evaluateR3(reviews);
      expect(result.isTriggered).toBe(false);
      expect(result.severity).toBe("low");
      expect(result.metricValue).toBe(50);
      expect(result.affectedEntityRefs).toHaveLength(0);
    });
  });

  describe("R4 - CI Friction Risk", () => {
    it("should trigger High severity risk if failed rate is > 40%", () => {
      const checkRuns = [
        { conclusion: "failure" } as ICheckRun,
        { conclusion: "failure" } as ICheckRun,
        { conclusion: "success" } as ICheckRun, // 2/3 = 66.7%
      ];
      const result = RiskRuleEngine.evaluateR4(checkRuns);
      expect(result.isTriggered).toBe(true);
      expect(result.severity).toBe("high");
      expect(result.metricValue).toBe(66.7);
      expect(result.thresholdValue).toBe(40);
      expect(result.affectedEntityRefs).toHaveLength(2);
    });

    it("should trigger Medium severity risk if failed rate is > 20% but <= 40%", () => {
      const checkRuns = [
        { conclusion: "failure" } as ICheckRun,
        { conclusion: "success" } as ICheckRun,
        { conclusion: "success" } as ICheckRun,
        { conclusion: "success" } as ICheckRun, // 1/4 = 25%
      ];
      const result = RiskRuleEngine.evaluateR4(checkRuns);
      expect(result.isTriggered).toBe(true);
      expect(result.severity).toBe("medium");
      expect(result.metricValue).toBe(25);
      expect(result.thresholdValue).toBe(20);
      expect(result.affectedEntityRefs).toHaveLength(1);
    });

    it("should not trigger risk if failed rate is <= 20%", () => {
      const checkRuns = [
        { conclusion: "failure" } as ICheckRun,
        { conclusion: "success" } as ICheckRun,
        { conclusion: "success" } as ICheckRun,
        { conclusion: "success" } as ICheckRun,
        { conclusion: "success" } as ICheckRun,
        { conclusion: "success" } as ICheckRun, // 1/6 = 16.7%
      ];
      const result = RiskRuleEngine.evaluateR4(checkRuns);
      expect(result.isTriggered).toBe(false);
      expect(result.severity).toBe("low");
      expect(result.metricValue).toBe(16.7);
      expect(result.affectedEntityRefs).toHaveLength(0);
    });
  });

  describe("R5 - Oversized PR Risk", () => {
    it("should trigger High severity risk if PR is > 1000 lines", () => {
      const prs = [
        { additions: 600, deletions: 500 } as IPullRequest, // 1100 lines
      ];
      const result = RiskRuleEngine.evaluateR5(prs);
      expect(result.isTriggered).toBe(true);
      expect(result.severity).toBe("high");
      expect(result.metricValue).toBe(1100);
      expect(result.thresholdValue).toBe(1000);
      expect(result.affectedEntityRefs).toHaveLength(1);
    });

    it("should trigger Medium severity risk if PR is > 500 lines but <= 1000 lines", () => {
      const prs = [
        { additions: 400, deletions: 200 } as IPullRequest, // 600 lines
      ];
      const result = RiskRuleEngine.evaluateR5(prs);
      expect(result.isTriggered).toBe(true);
      expect(result.severity).toBe("medium");
      expect(result.metricValue).toBe(600);
      expect(result.thresholdValue).toBe(500);
      expect(result.affectedEntityRefs).toHaveLength(1);
    });

    it("should not trigger risk if PR size is <= 500 lines", () => {
      const prs = [
        { additions: 200, deletions: 100 } as IPullRequest, // 300 lines
      ];
      const result = RiskRuleEngine.evaluateR5(prs);
      expect(result.isTriggered).toBe(false);
      expect(result.severity).toBe("low");
      expect(result.metricValue).toBe(300);
      expect(result.affectedEntityRefs).toHaveLength(0);
    });
  });
});
