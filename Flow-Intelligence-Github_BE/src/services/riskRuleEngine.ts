import mongoose from "mongoose";
import { FlowRule, IFlowRule } from "../models/FlowRule.js";
import { RiskEvent, IRiskEvent, RiskSeverity } from "../models/RiskEvent.js";
import { EvidenceCard } from "../models/EvidenceCard.js";
import { PullRequest, IPullRequest } from "../models/PullRequest.js";
import { Review, IReview } from "../models/Review.js";
import { CheckRun, ICheckRun } from "../models/CheckRun.js";
import { Recommendation } from "../models/Recommendation.js";
import { DataQualityWarning, DataQualityCode } from "../models/DataQualityWarning.js";
import {
  FlowRuleRepository,
  RecommendationRepository,
  RiskEventRepository,
  PullRequestRepository,
  ReviewRepository,
  CheckRunRepository
} from "../repositories/flowRisk.repository.js";

// ─── Interfaces & DTOs ────────────────────────────────────────────────────────

export interface EvidenceItemDTO {
  entityType: string;
  entityId: string;
  label: string;
  githubUrl: string | null;
}

export interface EvidenceCardDTO {
  id: string;
  title: string;
  severity: string;
  summary: string;
  suggestedAction: string;
  confidence: string;
  limitation: string;
  evidence: EvidenceItemDTO[];
  createdAt: string;
}

export interface RiskEventDTO {
  id: string;
  ruleCode: string;
  ruleName: string;
  ruleDescription: string;
  severity: string;
  status: string;
  metricValue: number;
  metricLabel: string;
  thresholdValue: number;
  thresholdUnit: string;
  isTriggered: boolean;
  windowStart: string;
  windowEnd: string;
  evidenceCard: EvidenceCardDTO | null;
  createdAt: string;
}

export interface RiskEvaluationResult {
  repositoryId: string;
  windowDays: number;
  windowStart: Date;
  windowEnd: Date;
  overallRisk: "high" | "medium" | "low" | "good";
  triggeredCount: number;
  events: RiskEventDTO[];
  evaluatedAt: Date;
}

// ─── Pure Calculation Engine (UC-13 Specs) ────────────────────────────────────

export class RiskRuleEngine {
  /**
   * R1: Stale PR Risk
   * Calculation: PR Age = Current Time - prCreatedAt
   * Rules: > 3 days = Medium, > 7 days = High
   */
  static evaluateR1(openPRs: IPullRequest[], now: Date): {
    isTriggered: boolean;
    severity: RiskSeverity;
    metricValue: number;
    thresholdValue: number;
    affectedEntityRefs: mongoose.Types.ObjectId[];
  } {
    let maxAgeDays = 0;
    const affectedEntityRefs: mongoose.Types.ObjectId[] = [];

    for (const pr of openPRs) {
      const ageMs = now.getTime() - pr.createdAt.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays > maxAgeDays) {
        maxAgeDays = ageDays;
      }
      if (ageDays > 3) {
        affectedEntityRefs.push(pr._id as mongoose.Types.ObjectId);
      }
    }

    const roundedMaxAge = Math.round(maxAgeDays * 10) / 10;

    if (maxAgeDays > 7) {
      return {
        isTriggered: true,
        severity: "high",
        metricValue: roundedMaxAge,
        thresholdValue: 7,
        affectedEntityRefs,
      };
    } else if (maxAgeDays > 3) {
      return {
        isTriggered: true,
        severity: "medium",
        metricValue: roundedMaxAge,
        thresholdValue: 3,
        affectedEntityRefs,
      };
    }

    return {
      isTriggered: false,
      severity: "low",
      metricValue: roundedMaxAge,
      thresholdValue: 3,
      affectedEntityRefs: [],
    };
  }

  /**
   * R2: Review Pickup Risk
   * Calculation: Pickup Time = First Review Time - PR Created Time (in hours)
   * Rules: > 24 hours = Medium, > 48 hours = High
   */
  static evaluateR2(prsWithPickup: { prId: mongoose.Types.ObjectId; pickupHours: number }[]): {
    isTriggered: boolean;
    severity: RiskSeverity;
    metricValue: number;
    thresholdValue: number;
    affectedEntityRefs: mongoose.Types.ObjectId[];
  } {
    if (prsWithPickup.length === 0) {
      return {
        isTriggered: false,
        severity: "low",
        metricValue: 0,
        thresholdValue: 24,
        affectedEntityRefs: [],
      };
    }

    const totalHours = prsWithPickup.reduce((sum, item) => sum + item.pickupHours, 0);
    const avgHours = totalHours / prsWithPickup.length;
    const roundedAvg = Math.round(avgHours * 10) / 10;

    const affectedEntityRefs = prsWithPickup
      .filter((p) => p.pickupHours > 24)
      .map((p) => p.prId);

    if (avgHours > 48) {
      return {
        isTriggered: true,
        severity: "high",
        metricValue: roundedAvg,
        thresholdValue: 48,
        affectedEntityRefs,
      };
    } else if (avgHours > 24) {
      return {
        isTriggered: true,
        severity: "medium",
        metricValue: roundedAvg,
        thresholdValue: 24,
        affectedEntityRefs,
      };
    }

    return {
      isTriggered: false,
      severity: "low",
      metricValue: roundedAvg,
      thresholdValue: 24,
      affectedEntityRefs: [],
    };
  }

  /**
   * R3: Reviewer Concentration Risk
   * Calculation: Reviewer Share = Reviewer Review Count / Total Reviews * 100
   * Rules: > 50% = Medium, > 70% = High
   */
  static evaluateR3(reviews: IReview[]): {
    isTriggered: boolean;
    severity: RiskSeverity;
    metricValue: number;
    thresholdValue: number;
    affectedEntityRefs: mongoose.Types.ObjectId[];
  } {
    if (reviews.length === 0) {
      return {
        isTriggered: false,
        severity: "low",
        metricValue: 0,
        thresholdValue: 50,
        affectedEntityRefs: [],
      };
    }

    const counts = new Map<string, { id: mongoose.Types.ObjectId; count: number }>();
    for (const r of reviews) {
      const key = r.reviewerId.toString();
      const existing = counts.get(key) || { id: r.reviewerId, count: 0 };
      existing.count += 1;
      counts.set(key, existing);
    }

    let maxShare = 0;
    let topReviewerId: mongoose.Types.ObjectId | null = null;

    for (const [_, val] of counts.entries()) {
      const share = (val.count / reviews.length) * 100;
      if (share > maxShare) {
        maxShare = share;
        topReviewerId = val.id;
      }
    }

    const roundedShare = Math.round(maxShare * 10) / 10;

    const affectedEntityRefs = topReviewerId
      ? reviews.filter((r) => r.reviewerId.toString() === topReviewerId!.toString()).map((r) => r._id as mongoose.Types.ObjectId)
      : [];

    if (maxShare > 70) {
      return {
        isTriggered: true,
        severity: "high",
        metricValue: roundedShare,
        thresholdValue: 70,
        affectedEntityRefs,
      };
    } else if (maxShare > 50) {
      return {
        isTriggered: true,
        severity: "medium",
        metricValue: roundedShare,
        thresholdValue: 50,
        affectedEntityRefs,
      };
    }

    return {
      isTriggered: false,
      severity: "low",
      metricValue: roundedShare,
      thresholdValue: 50,
      affectedEntityRefs: [],
    };
  }

  /**
   * R4: CI Friction Risk
   * Calculation: Failed Check Rate = Failed Checks / Total Checks * 100
   * Rules: > 20% = Medium, > 40% = High
   */
  static evaluateR4(checkRuns: ICheckRun[]): {
    isTriggered: boolean;
    severity: RiskSeverity;
    metricValue: number;
    thresholdValue: number;
    affectedEntityRefs: mongoose.Types.ObjectId[];
  } {
    if (checkRuns.length === 0) {
      return {
        isTriggered: false,
        severity: "low",
        metricValue: 0,
        thresholdValue: 20,
        affectedEntityRefs: [],
      };
    }

    const failed = checkRuns.filter((c) => c.conclusion === "failure" || c.conclusion === "timed_out");
    const rate = (failed.length / checkRuns.length) * 100;
    const roundedRate = Math.round(rate * 10) / 10;

    const affectedEntityRefs = failed.map((c) => c._id as mongoose.Types.ObjectId);

    if (rate > 40) {
      return {
        isTriggered: true,
        severity: "high",
        metricValue: roundedRate,
        thresholdValue: 40,
        affectedEntityRefs,
      };
    } else if (rate > 20) {
      return {
        isTriggered: true,
        severity: "medium",
        metricValue: roundedRate,
        thresholdValue: 20,
        affectedEntityRefs,
      };
    }

    return {
      isTriggered: false,
      severity: "low",
      metricValue: roundedRate,
      thresholdValue: 20,
      affectedEntityRefs: [],
    };
  }

  /**
   * R5: Oversized PR Risk
   * Calculation: PR Size = additions + deletions
   * Rules: > 500 lines = Medium, > 1000 lines = High
   */
  static evaluateR5(prs: IPullRequest[]): {
    isTriggered: boolean;
    severity: RiskSeverity;
    metricValue: number;
    thresholdValue: number;
    affectedEntityRefs: mongoose.Types.ObjectId[];
  } {
    let maxSize = 0;
    const affectedEntityRefs: mongoose.Types.ObjectId[] = [];

    for (const pr of prs) {
      const size = pr.additions + pr.deletions;
      if (size > maxSize) {
        maxSize = size;
      }
      if (size > 500) {
        affectedEntityRefs.push(pr._id as mongoose.Types.ObjectId);
      }
    }

    if (maxSize > 1000) {
      return {
        isTriggered: true,
        severity: "high",
        metricValue: maxSize,
        thresholdValue: 1000,
        affectedEntityRefs,
      };
    } else if (maxSize > 500) {
      return {
        isTriggered: true,
        severity: "medium",
        metricValue: maxSize,
        thresholdValue: 500,
        affectedEntityRefs,
      };
    }

    return {
      isTriggered: false,
      severity: "low",
      metricValue: maxSize,
      thresholdValue: 500,
      affectedEntityRefs: [],
    };
  }
}

// ─── Service Layer Implementation (UC-13) ─────────────────────────────────────

export class RiskEvaluationService {
  constructor(
    private flowRuleRepo: FlowRuleRepository,
    private recommendationRepo: RecommendationRepository,
    private riskEventRepo: RiskEventRepository,
    private prRepo: PullRequestRepository,
    private reviewRepo: ReviewRepository,
    private checkRunRepo: CheckRunRepository
  ) {}

  async evaluateRepository(
    repositoryId: string,
    windowDays: number = 7,
    startDate?: Date,
    endDate?: Date
  ): Promise<RiskEvaluationResult> {
    const repoId = new mongoose.Types.ObjectId(repositoryId);
    const end = endDate || new Date();
    const start = startDate || (windowDays === 0 ? new Date(0) : new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000));
    const calculatedDays = startDate && endDate
      ? Math.round(Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      : windowDays;

    // Load active rules definitions
    const activeRules = await this.flowRuleRepo.findActive();

    // Check repository PR count for data quality warning / R1 insufficient check
    const totalPRsCount = await this.prRepo.countAll(repositoryId);
    if (totalPRsCount === 0) {
      await this.upsertWarning(repoId, "no_pr_data", "No pull request data found. Analytics are restricted.");
    } else {
      await this.resolveWarning(repoId, "no_pr_data");
    }

    // Load data needed for evaluations
    const openPRs = await this.prRepo.findOpenPRs(repositoryId);
    const prsInWindow = await this.prRepo.findPRsInWindow(repositoryId, start, end);
    const reviewsInWindow = await this.reviewRepo.findReviewsInWindow(repositoryId, start, end);
    const checkRunsInWindow = await this.checkRunRepo.findCheckRunsInWindow(repositoryId, start, end);

    // Prepare R2 (Review Pickup Time) pickup array
    const prsWithPickup: { prId: mongoose.Types.ObjectId; pickupHours: number }[] = [];
    for (const pr of prsInWindow) {
      const readyAt = pr.readyForReviewAt ?? pr.createdAt;
      const reviews = await this.reviewRepo.findPRReviews(pr._id.toString(), readyAt);
      if (reviews.length > 0) {
        const hours = (reviews[0].submittedAt.getTime() - readyAt.getTime()) / 3_600_000;
        prsWithPickup.push({ prId: pr._id as mongoose.Types.ObjectId, pickupHours: hours });
      }
    }

    const results: RiskEventDTO[] = [];

    // Run rules R1–R5
    for (const rule of activeRules) {
      const recs = await this.recommendationRepo.findByRuleCode(rule.ruleCode);
      const suggestedAction = recs[0]?.description
        ?? "Review the affected items and discuss process improvements with the team.";

      let isInsufficient = false;
      let evalResult: ReturnType<typeof RiskRuleEngine.evaluateR1>;

      if (rule.ruleCode === "R1") {
        if (totalPRsCount === 0) {
          isInsufficient = true;
        } else {
          evalResult = RiskRuleEngine.evaluateR1(openPRs, end);
        }
      } else if (rule.ruleCode === "R2") {
        if (prsWithPickup.length === 0) {
          isInsufficient = true;
          await this.upsertWarning(repoId, "no_review_data", "No PR review pickup time data in window.");
        } else {
          isInsufficient = false;
          await this.resolveWarning(repoId, "no_review_data");
          evalResult = RiskRuleEngine.evaluateR2(prsWithPickup);
        }
      } else if (rule.ruleCode === "R3") {
        if (reviewsInWindow.length === 0) {
          isInsufficient = true;
        } else {
          evalResult = RiskRuleEngine.evaluateR3(reviewsInWindow);
        }
      } else if (rule.ruleCode === "R4") {
        if (checkRunsInWindow.length === 0) {
          isInsufficient = true;
          await this.upsertWarning(repoId, "missing_checks_permission", "No check runs found in this window. Verifications missing.");
        } else {
          isInsufficient = false;
          await this.resolveWarning(repoId, "missing_checks_permission");
          evalResult = RiskRuleEngine.evaluateR4(checkRunsInWindow);
        }
      } else if (rule.ruleCode === "R5") {
        if (prsInWindow.length === 0) {
          isInsufficient = true;
        } else {
          evalResult = RiskRuleEngine.evaluateR5(prsInWindow);
        }
      } else {
        continue;
      }

      if (isInsufficient) {
        // Insufficient state: do not create active risk event
        // If there's an existing active event, resolve it
        const existing = await this.riskEventRepo.findLatestActive(repositoryId, rule.ruleCode);
        if (existing) {
          existing.status = "resolved";
          await existing.save();
        }

        results.push({
          id: existing?._id.toString() ?? "",
          ruleCode: rule.ruleCode,
          ruleName: rule.name,
          ruleDescription: rule.description,
          severity: "low",
          status: "insufficient_data",
          metricValue: 0,
          metricLabel: METRIC_LABELS[rule.ruleCode] ?? rule.ruleCode,
          thresholdValue: rule.threshold,
          thresholdUnit: rule.thresholdUnit,
          isTriggered: false,
          windowStart: start.toISOString(),
          windowEnd: end.toISOString(),
          evidenceCard: null,
          createdAt: new Date().toISOString(),
        });
      } else {
        // Load latest RiskEvent regardless of status
        const existingEvent = await this.riskEventRepo.findLatest(repositoryId, rule.ruleCode);
        let riskEvent: any;

        if (existingEvent) {
          existingEvent.metricValue = evalResult!.metricValue;
          existingEvent.thresholdValue = evalResult!.thresholdValue;
          existingEvent.windowStart = start;
          existingEvent.windowEnd = end;
          existingEvent.status = evalResult!.isTriggered ? "active" : "resolved";
          existingEvent.severity = evalResult!.isTriggered ? evalResult!.severity : "low";
          existingEvent.affectedEntityRefs = evalResult!.affectedEntityRefs;
          existingEvent.limitation = "Based on data within the selected window. Patterns may differ over longer periods.";
          await existingEvent.save();
          riskEvent = existingEvent;
        } else {
          riskEvent = await this.riskEventRepo.create({
            repositoryId: repoId,
            ruleCode: rule.ruleCode as any,
            severity: evalResult!.isTriggered ? evalResult!.severity : "low",
            status: evalResult!.isTriggered ? "active" : "resolved",
            metricValue: evalResult!.metricValue,
            thresholdValue: evalResult!.thresholdValue,
            windowStart: start,
            windowEnd: end,
            affectedEntityRefs: evalResult!.affectedEntityRefs,
            limitation: "Based on data within the selected window. Patterns may differ over longer periods.",
          });
        }

        // Build evidence card containing actual stale PR / review / check references
        const card = await this.buildEvidenceCard(repoId, riskEvent._id, rule, evalResult!, suggestedAction);

        results.push({
          id: riskEvent._id.toString(),
          ruleCode: rule.ruleCode,
          ruleName: rule.name,
          ruleDescription: rule.description,
          severity: riskEvent.severity,
          status: riskEvent.status,
          metricValue: riskEvent.metricValue,
          metricLabel: METRIC_LABELS[rule.ruleCode] ?? rule.ruleCode,
          thresholdValue: riskEvent.thresholdValue,
          thresholdUnit: rule.thresholdUnit,
          isTriggered: evalResult!.isTriggered,
          windowStart: riskEvent.windowStart.toISOString(),
          windowEnd: riskEvent.windowEnd.toISOString(),
          evidenceCard: card ? {
            id: card._id.toString(),
            title: card.title,
            severity: card.severity,
            summary: card.summary,
            suggestedAction: card.suggestedAction,
            confidence: card.confidence,
            limitation: card.limitation,
            evidence: card.evidence.map((ev: any) => ({
              entityType: ev.entityType,
              entityId: ev.entityId.toString(),
              label: ev.label,
              githubUrl: ev.githubUrl,
            })),
            createdAt: card.createdAt.toISOString(),
          } : null,
          createdAt: riskEvent.createdAt.toISOString(),
        });
      }
    }

    // Sort: triggered first, then by severity
    results.sort((a, b) => {
      if (a.isTriggered !== b.isTriggered) return a.isTriggered ? -1 : 1;
      const sOrd: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (sOrd[a.severity] ?? 9) - (sOrd[b.severity] ?? 9);
    });

    const triggered = results.filter((e) => e.isTriggered);
    const overallRisk =
      triggered.length === 0 ? "good"
      : triggered.some((e) => e.severity === "high") ? "high"
      : triggered.length >= 2 ? "medium"
      : "low";

    return {
      repositoryId,
      windowDays: calculatedDays || 1,
      windowStart: start,
      windowEnd: end,
      overallRisk,
      triggeredCount: triggered.length,
      events: results,
      evaluatedAt: new Date(),
    };
  }

  async getLatestEvaluations(
    repositoryId: string,
    windowDays: number = 7,
    startDate?: Date,
    endDate?: Date
  ): Promise<RiskEvaluationResult | null> {
    const repoId = new mongoose.Types.ObjectId(repositoryId);
    const end = endDate || new Date();
    const start = startDate || (windowDays === 0 ? new Date(0) : new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000));
    const calculatedDays = startDate && endDate
      ? Math.round(Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      : windowDays;

    const events = await this.riskEventRepo.findManyByRepository(repositoryId, start);
    if (events.length === 0) return null;

    const activeRules = await this.flowRuleRepo.findActive();
    const ruleMap = new Map(activeRules.map((r) => [r.ruleCode, r]));

    const seenRules = new Set<string>();
    const dtos: RiskEventDTO[] = [];

    for (const ev of events) {
      if (seenRules.has(ev.ruleCode)) continue;
      const rule = ruleMap.get(ev.ruleCode);
      if (!rule) continue;
      seenRules.add(ev.ruleCode);

      const card = await EvidenceCard.findOne({ riskEventId: ev._id }).lean();
      const isTriggered = ev.status === "active";

      dtos.push({
        id: ev._id.toString(),
        ruleCode: ev.ruleCode,
        ruleName: rule.name,
        ruleDescription: rule.description,
        severity: ev.severity,
        status: ev.status,
        metricValue: ev.metricValue,
        metricLabel: METRIC_LABELS[ev.ruleCode] ?? ev.ruleCode,
        thresholdValue: ev.thresholdValue,
        thresholdUnit: rule.thresholdUnit,
        isTriggered,
        windowStart: ev.windowStart.toISOString(),
        windowEnd: ev.windowEnd.toISOString(),
        evidenceCard: card ? {
          id: card._id.toString(),
          title: card.title,
          severity: card.severity,
          summary: card.summary,
          suggestedAction: card.suggestedAction,
          confidence: card.confidence,
          limitation: card.limitation,
          evidence: card.evidence.map((e: any) => ({
            entityType: e.entityType,
            entityId: e.entityId.toString(),
            label: e.label,
            githubUrl: e.githubUrl,
          })),
          createdAt: card.createdAt.toISOString(),
        } : null,
        createdAt: ev.createdAt.toISOString(),
      });
    }

    dtos.sort((a, b) => {
      if (a.isTriggered !== b.isTriggered) return a.isTriggered ? -1 : 1;
      const sOrd: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (sOrd[a.severity] ?? 9) - (sOrd[b.severity] ?? 9);
    });

    const triggered = dtos.filter((e) => e.isTriggered);
    const overallRisk =
      triggered.length === 0 ? "good"
      : triggered.some((e) => e.severity === "high") ? "high"
      : triggered.length >= 2 ? "medium"
      : "low";

    return {
      repositoryId,
      windowDays: calculatedDays || 1,
      windowStart: start,
      windowEnd: end,
      overallRisk,
      triggeredCount: triggered.length,
      events: dtos,
      evaluatedAt: events[0].createdAt,
    };
  }

  private async buildEvidenceCard(
    repositoryId: mongoose.Types.ObjectId,
    riskEventId: mongoose.Types.ObjectId,
    rule: IFlowRule,
    evalResult: { isTriggered: boolean; severity: RiskSeverity; metricValue: number; thresholdValue: number; affectedEntityRefs: mongoose.Types.ObjectId[] },
    suggestedAction: string
  ): Promise<any> {
    const evidenceItems: any[] = [];

    if (evalResult.affectedEntityRefs.length > 0) {
      if (rule.ruleCode === "R1" || rule.ruleCode === "R2" || rule.ruleCode === "R5") {
        // Query PRs
        const prs = await PullRequest.find({ _id: { $in: evalResult.affectedEntityRefs } }).select("_id number title prUrl additions deletions").lean();
        for (const pr of prs) {
          let label = `#${pr.number} ${pr.title}`;
          if (rule.ruleCode === "R5") {
            label += ` (+${pr.additions}/-${pr.deletions} lines)`;
          }
          evidenceItems.push({
            entityType: "pull_request",
            entityId: pr._id,
            label,
            githubUrl: pr.prUrl || null,
          });
        }
      } else if (rule.ruleCode === "R3") {
        // Query Reviews
        const reviews = await Review.find({ _id: { $in: evalResult.affectedEntityRefs } }).select("_id userLogin").lean();
        for (const rev of reviews) {
          evidenceItems.push({
            entityType: "review",
            entityId: rev._id,
            label: `Review by ${rev.userLogin}`,
            githubUrl: null,
          });
        }
      } else if (rule.ruleCode === "R4") {
        // Query Checks
        const checks = await CheckRun.find({ _id: { $in: evalResult.affectedEntityRefs } }).select("_id name conclusion").lean();
        for (const check of checks) {
          evidenceItems.push({
            entityType: "check_run",
            entityId: check._id,
            label: `${check.name}: ${check.conclusion}`,
            githubUrl: null,
          });
        }
      }
    }

    // Always delete existing card for the event first
    await EvidenceCard.findOneAndDelete({ riskEventId });

    // Save EvidenceCard
    const card = await EvidenceCard.create({
      repositoryId,
      riskEventId,
      predictionId: null,
      sourceType: "rule_based",
      title: evalResult.isTriggered ? `${rule.name} detected` : `${rule.name} (not triggered)`,
      severity: evalResult.isTriggered ? evalResult.severity : "low",
      summary: buildSummary(rule.ruleCode, evalResult.metricValue, evalResult.thresholdValue, rule.thresholdUnit),
      suggestedAction,
      confidence: "high",
      limitation: "Based on data within the selected window. Patterns may differ over longer periods.",
      evidence: evidenceItems,
    });

    return card;
  }

  private async upsertWarning(repositoryId: mongoose.Types.ObjectId, code: DataQualityCode, message: string) {
    await DataQualityWarning.findOneAndUpdate(
      { repositoryId, code, resolvedAt: null },
      {
        $set: {
          repositoryId,
          code,
          severity: "warning",
          message,
          resolvedAt: null,
        }
      },
      { upsert: true, new: true }
    );
  }

  private async resolveWarning(repositoryId: mongoose.Types.ObjectId, code: DataQualityCode) {
    await DataQualityWarning.updateMany(
      { repositoryId, code, resolvedAt: null },
      { $set: { resolvedAt: new Date() } }
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
  R1: "Max PR age (days)",
  R2: "Avg review pickup (hrs)",
  R3: "Top reviewer load (%)",
  R4: "Failed check rate (%)",
  R5: "Max PR size (lines)",
};

function buildSummary(code: string, value: number, threshold: number, unit: string): string {
  const fmt = unit === "%" ? `${value.toFixed(1)}%` : unit === "hours" ? `${value.toFixed(1)}h` : String(Math.round(value));
  const thr = unit === "%" ? `${threshold}%` : unit === "hours" ? `${threshold}h` : String(threshold);
  const msgs: Record<string, string> = {
    R1: `Maximum PR age is ${fmt} days (threshold: ${thr} days). Open PRs are waiting too long.`,
    R2: `Average review pickup time is ${fmt} (threshold: ${thr}). PRs are sitting unreviewed.`,
    R3: `Top reviewer concentration is ${fmt} (threshold: ${thr}). High bus factor risk.`,
    R4: `Failed check rate is ${fmt} (threshold: ${thr}). CI build pipeline is highly unstable.`,
    R5: `Maximum PR size is ${fmt} lines (threshold: ${thr} lines). Large changes slow down reviews.`,
  };
  return msgs[code] ?? `Metric ${fmt} exceeded threshold ${thr}.`;
}

// ─── Exposed functions for Express Controller compatibility ─────────────────

const initService = () => {
  const flowRuleRepo = new FlowRuleRepository();
  const recRepo = new RecommendationRepository();
  const riskRepo = new RiskEventRepository();
  const prRepo = new PullRequestRepository();
  const reviewRepo = new ReviewRepository();
  const checkRepo = new CheckRunRepository();
  return new RiskEvaluationService(flowRuleRepo, recRepo, riskRepo, prRepo, reviewRepo, checkRepo);
};

export async function evaluateRiskRules(
  repositoryId: string,
  windowDays = 7,
  startDate?: Date,
  endDate?: Date
): Promise<RiskEvaluationResult> {
  const service = initService();
  return service.evaluateRepository(repositoryId, windowDays, startDate, endDate);
}

export async function getLatestRiskEvents(
  repositoryId: string,
  windowDays = 7,
  startDate?: Date,
  endDate?: Date
): Promise<RiskEvaluationResult | null> {
  const service = initService();
  return service.getLatestEvaluations(repositoryId, windowDays, startDate, endDate);
}
