import mongoose from "mongoose";
import { FlowRule, IFlowRule } from "../models/FlowRule.js";
import { RiskEvent, IRiskEvent, RiskSeverity } from "../models/RiskEvent.js";
import { EvidenceCard } from "../models/EvidenceCard.js";
import { PullRequest, IPullRequest } from "../models/PullRequest.js";
import { Review, IReview } from "../models/Review.js";
import { CheckRun, ICheckRun } from "../models/CheckRun.js";
import { Recommendation } from "../models/Recommendation.js";
import { DataQualityWarning, DataQualityCode } from "../models/DataQualityWarning.js";
import { MetricSnapshot, MetricKey } from "../models/MetricSnapshot.js";
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
  summary?: string;
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

/**
 * Per-item reasoning: each affected entity carries a short note explaining *why*
 * it is evidence for this rule (e.g. "Waited 38h for first review"). Notes are
 * computed alongside the metric so they stay in sync with the numbers.
 */
export interface AffectedItem {
  id: mongoose.Types.ObjectId;
  note: string;
}

export interface RuleEvalResult {
  isTriggered: boolean;
  severity: RiskSeverity;
  metricValue: number;
  thresholdValue: number;
  affectedEntityRefs: mongoose.Types.ObjectId[];
  affectedDetails: AffectedItem[];
}

// ─── Pure Calculation Engine (UC-13 Specs) ────────────────────────────────────

export class RiskRuleEngine {
  /**
   * R1: Stale PR Risk
   * Calculation: PR Age = Current Time - prCreatedAt
   * Rules: > 3 days = Medium, > 7 days = High
   */
  static evaluateR1(openPRs: IPullRequest[], now: Date): RuleEvalResult {
    let maxAgeDays = 0;
    const affectedDetails: AffectedItem[] = [];

    for (const pr of openPRs) {
      const ageMs = now.getTime() - pr.createdAt.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays > maxAgeDays) {
        maxAgeDays = ageDays;
      }
      if (ageDays > 3) {
        affectedDetails.push({
          id: pr._id as mongoose.Types.ObjectId,
          note: `Open for ${Math.round(ageDays * 10) / 10}d — over 3d threshold`,
        });
      }
    }

    const affectedEntityRefs = affectedDetails.map((d) => d.id);
    const roundedMaxAge = Math.round(maxAgeDays * 10) / 10;

    if (maxAgeDays > 7) {
      return { isTriggered: true, severity: "high", metricValue: roundedMaxAge, thresholdValue: 7, affectedEntityRefs, affectedDetails };
    } else if (maxAgeDays > 3) {
      return { isTriggered: true, severity: "medium", metricValue: roundedMaxAge, thresholdValue: 3, affectedEntityRefs, affectedDetails };
    }

    return { isTriggered: false, severity: "low", metricValue: roundedMaxAge, thresholdValue: 3, affectedEntityRefs: [], affectedDetails: [] };
  }

  /**
   * R2: Review Pickup Risk
   * Calculation: Pickup Time = First Review Time - PR Created Time (in hours)
   * Rules: > 24 hours = Medium, > 48 hours = High
   */
  static evaluateR2(prsWithPickup: { prId: mongoose.Types.ObjectId; pickupHours: number }[]): RuleEvalResult {
    if (prsWithPickup.length === 0) {
      return { isTriggered: false, severity: "low", metricValue: 0, thresholdValue: 24, affectedEntityRefs: [], affectedDetails: [] };
    }

    const totalHours = prsWithPickup.reduce((sum, item) => sum + item.pickupHours, 0);
    const avgHours = totalHours / prsWithPickup.length;
    const roundedAvg = Math.round(avgHours * 10) / 10;

    const affectedDetails: AffectedItem[] = prsWithPickup
      .filter((p) => p.pickupHours > 24)
      .map((p) => ({ id: p.prId, note: `Waited ${Math.round(p.pickupHours)}h for first review` }));
    const affectedEntityRefs = affectedDetails.map((d) => d.id);

    if (avgHours > 48) {
      return { isTriggered: true, severity: "high", metricValue: roundedAvg, thresholdValue: 48, affectedEntityRefs, affectedDetails };
    } else if (avgHours > 24) {
      return { isTriggered: true, severity: "medium", metricValue: roundedAvg, thresholdValue: 24, affectedEntityRefs, affectedDetails };
    }

    return { isTriggered: false, severity: "low", metricValue: roundedAvg, thresholdValue: 24, affectedEntityRefs: [], affectedDetails: [] };
  }

  /**
   * R3: Reviewer Concentration Risk
   * Calculation: Reviewer Share = Reviewer Review Count / Total Reviews * 100
   * Rules: > 50% = Medium, > 70% = High
   */
  static evaluateR3(reviews: IReview[]): RuleEvalResult {
    if (reviews.length === 0) {
      return { isTriggered: false, severity: "low", metricValue: 0, thresholdValue: 50, affectedEntityRefs: [], affectedDetails: [] };
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
    let topCount = 0;

    for (const [_, val] of counts.entries()) {
      const share = (val.count / reviews.length) * 100;
      if (share > maxShare) {
        maxShare = share;
        topReviewerId = val.id;
        topCount = val.count;
      }
    }

    const roundedShare = Math.round(maxShare * 10) / 10;

    const affectedDetails: AffectedItem[] = topReviewerId
      ? reviews
          .filter((r) => r.reviewerId.toString() === topReviewerId!.toString())
          .map((r) => ({
            id: r._id as mongoose.Types.ObjectId,
            note: `One of the top reviewer's ${topCount} reviews (${roundedShare}% of ${reviews.length})`,
          }))
      : [];
    const affectedEntityRefs = affectedDetails.map((d) => d.id);

    if (maxShare > 70) {
      return { isTriggered: true, severity: "high", metricValue: roundedShare, thresholdValue: 70, affectedEntityRefs, affectedDetails };
    } else if (maxShare > 50) {
      return { isTriggered: true, severity: "medium", metricValue: roundedShare, thresholdValue: 50, affectedEntityRefs, affectedDetails };
    }

    return { isTriggered: false, severity: "low", metricValue: roundedShare, thresholdValue: 50, affectedEntityRefs: [], affectedDetails: [] };
  }

  /**
   * R4: CI Friction Risk
   * Calculation: Failed Check Rate = Failed Checks / Total Checks * 100
   * Rules: > 20% = Medium, > 40% = High
   */
  static evaluateR4(checkRuns: ICheckRun[]): RuleEvalResult {
    if (checkRuns.length === 0) {
      return { isTriggered: false, severity: "low", metricValue: 0, thresholdValue: 20, affectedEntityRefs: [], affectedDetails: [] };
    }

    const failed = checkRuns.filter((c) => c.conclusion === "failure" || c.conclusion === "timed_out");
    const rate = (failed.length / checkRuns.length) * 100;
    const roundedRate = Math.round(rate * 10) / 10;

    const affectedDetails: AffectedItem[] = failed.map((c) => ({
      id: c._id as mongoose.Types.ObjectId,
      note: `Check failed: ${c.conclusion}`,
    }));
    const affectedEntityRefs = affectedDetails.map((d) => d.id);

    if (rate > 40) {
      return { isTriggered: true, severity: "high", metricValue: roundedRate, thresholdValue: 40, affectedEntityRefs, affectedDetails };
    } else if (rate > 20) {
      return { isTriggered: true, severity: "medium", metricValue: roundedRate, thresholdValue: 20, affectedEntityRefs, affectedDetails };
    }

    return { isTriggered: false, severity: "low", metricValue: roundedRate, thresholdValue: 20, affectedEntityRefs: [], affectedDetails: [] };
  }

  /**
   * R5: Oversized PR Risk
   * Calculation: PR Size = additions + deletions
   * Rules: > 500 lines = Medium, > 1000 lines = High
   */
  static evaluateR5(prs: IPullRequest[]): RuleEvalResult {
    let maxSize = 0;
    const affectedDetails: AffectedItem[] = [];

    for (const pr of prs) {
      const size = pr.additions + pr.deletions;
      if (size > maxSize) {
        maxSize = size;
      }
      if (size > 500) {
        affectedDetails.push({
          id: pr._id as mongoose.Types.ObjectId,
          note: `+${pr.additions}/-${pr.deletions} lines (${size} total) — over 500 threshold`,
        });
      }
    }

    const affectedEntityRefs = affectedDetails.map((d) => d.id);

    if (maxSize > 1000) {
      return { isTriggered: true, severity: "high", metricValue: maxSize, thresholdValue: 1000, affectedEntityRefs, affectedDetails };
    } else if (maxSize > 500) {
      return { isTriggered: true, severity: "medium", metricValue: maxSize, thresholdValue: 500, affectedEntityRefs, affectedDetails };
    }

    return { isTriggered: false, severity: "low", metricValue: maxSize, thresholdValue: 500, affectedEntityRefs: [], affectedDetails: [] };
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

        // Population totals for coverage ("N of M ...") on the evidence card.
        let totalPopulation = 0;
        let populationLabel = "items";
        switch (rule.ruleCode) {
          case "R1": totalPopulation = openPRs.length; populationLabel = "open PRs"; break;
          case "R2": totalPopulation = prsWithPickup.length; populationLabel = "reviewed PRs"; break;
          case "R3": totalPopulation = reviewsInWindow.length; populationLabel = "reviews"; break;
          case "R4": totalPopulation = checkRunsInWindow.length; populationLabel = "checks"; break;
          case "R5": totalPopulation = prsInWindow.length; populationLabel = "PRs"; break;
        }

        // Build evidence card containing actual stale PR / review / check references
        const card = await this.buildEvidenceCard(
          repoId, riskEvent._id, rule, evalResult!, suggestedAction,
          { windowStart: start, totalPopulation, populationLabel }
        );

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
              label: ev.sourceLabel ?? ev.label ?? "",
              githubUrl: ev.sourceUrl ?? ev.githubUrl ?? null,
              summary: ev.summary ?? "",
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
            label: e.sourceLabel ?? e.label ?? "",
            githubUrl: e.sourceUrl ?? e.githubUrl ?? null,
            summary: e.summary ?? "",
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
    evalResult: RuleEvalResult,
    suggestedAction: string,
    ctx: { windowStart: Date; totalPopulation: number; populationLabel: string }
  ): Promise<any> {
    // Per-item reasoning: each affected entity carries a note that explains *why*
    // it is evidence for this rule (computed alongside the metric in evaluateRx).
    const noteById = new Map<string, string>();
    for (const d of evalResult.affectedDetails) noteById.set(d.id.toString(), d.note);

    const evidenceItems: any[] = [];

    if (evalResult.affectedEntityRefs.length > 0) {
      if (rule.ruleCode === "R1" || rule.ruleCode === "R2" || rule.ruleCode === "R5") {
        // Query PRs
        const prs = await PullRequest.find({ _id: { $in: evalResult.affectedEntityRefs } }).select("_id number title prUrl additions deletions").lean();
        for (const pr of prs) {
          let sourceLabel = `#${pr.number} ${pr.title}`;
          if (rule.ruleCode === "R5") {
            sourceLabel += ` (+${pr.additions}/-${pr.deletions} lines)`;
          }
          evidenceItems.push({
            entityType: "pull_request",
            entityId: pr._id,
            sourceLabel,
            sourceUrl: pr.prUrl || "",
            summary: noteById.get(pr._id.toString()) ?? pr.title,
          });
        }
      } else if (rule.ruleCode === "R3") {
        // Query Reviews
        const reviews = await Review.find({ _id: { $in: evalResult.affectedEntityRefs } }).select("_id userLogin pullRequestId githubReviewId").lean();
        const prIds = reviews.map(r => r.pullRequestId).filter(Boolean);
        const prs = await PullRequest.find({ _id: { $in: prIds } }).select("_id prUrl").lean();
        const prUrlMap = new Map(prs.map(pr => [pr._id.toString(), pr.prUrl]));

        for (const rev of reviews) {
          const prUrl = rev.pullRequestId ? prUrlMap.get(rev.pullRequestId.toString()) : null;
          const reviewUrl = prUrl && rev.githubReviewId ? `${prUrl}#pullrequestreview-${rev.githubReviewId}` : "";
          evidenceItems.push({
            entityType: "review",
            entityId: rev._id,
            sourceLabel: `Review by ${rev.userLogin}`,
            sourceUrl: reviewUrl,
            summary: noteById.get(rev._id.toString()) ?? `Review by ${rev.userLogin}`,
          });
        }
      } else if (rule.ruleCode === "R4") {
        // Query Checks
        const checks = await CheckRun.find({ _id: { $in: evalResult.affectedEntityRefs } }).select("_id name conclusion pullRequestId githubCheckId repositoryId").lean();
        const prIds = checks.map(c => c.pullRequestId).filter(Boolean);
        const prs = await PullRequest.find({ _id: { $in: prIds } }).select("_id prUrl").lean();
        const prUrlMap = new Map(prs.map(pr => [pr._id.toString(), pr.prUrl]));
        
        for (const check of checks) {
          const prUrl = check.pullRequestId ? prUrlMap.get(check.pullRequestId.toString()) : null;
          // If we have PR URL, append /checks. Otherwise just use PR URL or empty string.
          // In a real app we might construct the GitHub Action run URL, but PR checks tab is a good fallback.
          let checkUrl = "";
          if (prUrl) {
            checkUrl = `${prUrl}/checks`;
          }
          evidenceItems.push({
            entityType: "check_run",
            entityId: check._id,
            sourceLabel: `${check.name}: ${check.conclusion}`,
            sourceUrl: checkUrl,
            summary: noteById.get(check._id.toString()) ?? `${check.name}: ${check.conclusion}`,
          });
        }
      }
    }

    // Always delete any existing card for the event first so a resolved / no-longer-evidenced
    // risk does not leave a stale card behind.
    await EvidenceCard.findOneAndDelete({ riskEventId });

    // Guardrail: an Evidence Card must be backed by real evidence. Do not create a card when
    // the rule is not triggered or when there are no resolvable evidence items — such a card
    // would show 0 exhibits and must never surface (see CLAUDE.md §7.6).
    if (!evalResult.isTriggered || evidenceItems.length === 0) {
      return null;
    }

    const affectedCount = evidenceItems.length;

    // Coverage: how representative is this card ("N of M ...").
    const coverage = ctx.totalPopulation > 0
      ? ` ${affectedCount} of ${ctx.totalPopulation} ${ctx.populationLabel} affected.`
      : "";

    // Trend: compare against the previous window's metric snapshot (if available).
    // Count-based rules (R1/R5) compare the affected count; the rest compare the metric.
    const isCountRule = rule.ruleCode === "R1" || rule.ruleCode === "R5";
    const trend = await this.buildTrendNote(
      repositoryId,
      rule.ruleCode,
      ctx.windowStart,
      isCountRule ? affectedCount : evalResult.metricValue,
      isCountRule ? ctx.populationLabel : rule.thresholdUnit
    );

    // Confidence derived from data completeness rather than hardcoded.
    const confidence = await this.deriveConfidence(repositoryId, rule.ruleCode, affectedCount);

    // Limitation carries a rule-specific caveat to head off false positives.
    const caveat = RULE_CAVEAT[rule.ruleCode];
    const limitation = caveat
      ? `Based on data within the selected window. Patterns may differ over longer periods. ${caveat}`
      : "Based on data within the selected window. Patterns may differ over longer periods.";

    // Save EvidenceCard
    const card = await EvidenceCard.create({
      repositoryId,
      riskEventId,
      predictionId: null,
      sourceType: "risk_event",
      title: `${rule.name} detected`,
      severity: evalResult.severity,
      summary: buildSummary(rule.ruleCode, evalResult.metricValue, evalResult.thresholdValue, rule.thresholdUnit) + coverage + trend,
      suggestedAction,
      confidence,
      limitation,
      evidence: evidenceItems,
    });

    return card;
  }

  /**
   * Trend note comparing the current value with the previous window's metric
   * snapshot (owned by the metrics module). Returns "" when no prior data exists.
   */
  private async buildTrendNote(
    repositoryId: mongoose.Types.ObjectId,
    ruleCode: string,
    windowStart: Date,
    current: number,
    unit: string
  ): Promise<string> {
    const metricKey = RULE_METRIC_KEY[ruleCode];
    if (!metricKey) return "";
    const prev = await MetricSnapshot.findOne({
      repositoryId,
      metricKey,
      windowEnd: { $lt: windowStart },
    })
      .sort({ windowEnd: -1 })
      .lean();
    if (!prev || prev.value == null) return "";
    const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
    const unitLabel = unit === "%" ? "%" : unit === "hours" ? "h" : ` ${unit}`;
    return ` Trend: ${fmt(prev.value)}${unitLabel} → ${fmt(current)}${unitLabel}.`;
  }

  /**
   * Confidence from data completeness: an unresolved data-quality warning for the
   * rule's metric, a non-ok snapshot status, a small sample, or very few affected
   * items lowers confidence to "medium". Otherwise "high". Never "low" — a card
   * that weak would not have been created.
   */
  private async deriveConfidence(
    repositoryId: mongoose.Types.ObjectId,
    ruleCode: string,
    affectedCount: number
  ): Promise<"high" | "medium"> {
    const warnCode = RULE_WARNING_CODE[ruleCode];
    if (warnCode) {
      const warn = await DataQualityWarning.findOne({ repositoryId, code: warnCode, resolvedAt: null }).lean();
      if (warn) return "medium";
    }
    const metricKey = RULE_METRIC_KEY[ruleCode];
    if (metricKey) {
      const snap = await MetricSnapshot.findOne({ repositoryId, metricKey }).sort({ windowEnd: -1 }).lean();
      if (snap && (snap.dataStatus !== "ok" || (snap.sampleSize ?? 0) < 5)) return "medium";
    }
    if (affectedCount < 2) return "medium";
    return "high";
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

// Maps each rule to the metric snapshot used for trend comparison. R1/R5 use a
// count proxy (no snapshot exists for max age / max size).
const RULE_METRIC_KEY: Record<string, MetricKey> = {
  R1: "stale_pr_count",
  R2: "review_pickup_time_avg_hours",
  R3: "review_load_top_reviewer_pct",
  R4: "failed_check_rate_pct",
  R5: "oversized_pr_count",
};

// Rule-specific caveat appended to the limitation, to head off false positives.
const RULE_CAVEAT: Record<string, string> = {
  R1: "Includes draft/WIP PRs that may be intentionally left open.",
  R2: "Counts only PRs that received a review; automated reviews are included.",
  R3: "Small teams naturally concentrate reviews on fewer people.",
  R4: "Counts required checks only; flaky tests can cause false positives.",
  R5: "Generated or vendored files can inflate line counts.",
};

// Which unresolved data-quality warning weakens confidence for each rule.
const RULE_WARNING_CODE: Record<string, DataQualityCode> = {
  R1: "no_pr_data",
  R2: "no_review_data",
  R3: "no_review_data",
  R4: "missing_checks_permission",
  R5: "no_pr_data",
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
