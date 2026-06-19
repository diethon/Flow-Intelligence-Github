/**
 * UC-13: Evaluate Delivery Flow Risk rules (R1–R5)
 *
 * For each rule:
 *  1. Compute the target metric from existing data.
 *  2. Compare against the rule threshold (from flowRules collection).
 *  3. If triggered  → upsert an active RiskEvent + build an EvidenceCard.
 *  4. If not triggered → mark any existing active event for that rule/window as resolved.
 */

import mongoose from "mongoose";
import { FlowRule }     from "../models/FlowRule.js";
import { RiskEvent }    from "../models/RiskEvent.js";
import { EvidenceCard } from "../models/EvidenceCard.js";
import { PullRequest }  from "../models/PullRequest.js";
import { Review }       from "../models/Review.js";
import { CheckRun }     from "../models/CheckRun.js";
import { Recommendation } from "../models/Recommendation.js";
import type { IEvidenceItem } from "../models/EvidenceCard.js";

// ─── Public types returned to the API layer ───────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function windowBounds(windowDays: number): { start: Date; end: Date } {
  const end   = new Date();
  const start = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  return { start, end };
}

function overallRisk(events: { isTriggered: boolean; severity: string }[]): "high" | "medium" | "low" | "good" {
  const triggered = events.filter((e) => e.isTriggered);
  if (triggered.length === 0)                                   return "good";
  if (triggered.some((e) => e.severity === "high"))             return "high";
  if (triggered.length >= 2)                                    return "medium";
  return "low";
}

// ─── Metric calculators (per rule) ───────────────────────────────────────────

async function computeMetrics(repoId: mongoose.Types.ObjectId, start: Date, end: Date) {
  // R1: Stale PRs — open for > 7 days (created before window start and still open)
  const stalePRs = await PullRequest.find({
    repositoryId: repoId,
    state: "open",
    isDraft: false,
    createdAt: { $lt: start },
  }).select("_id number title createdAt").lean();

  // R2: Avg review pickup time
  const mergedPRs = await PullRequest.find({
    repositoryId: repoId,
    state: "merged",
    mergedAt: { $gte: start, $lte: end },
  }).select("_id number title createdAt readyForReviewAt").lean();

  let totalPickupHours = 0;
  const slowPickupPRs: { prId: mongoose.Types.ObjectId; number: number; title: string; pickupHours: number }[] = [];

  for (const pr of mergedPRs) {
    const readyAt = pr.readyForReviewAt ?? pr.createdAt;
    const firstReview = await Review.findOne({ pullRequestId: pr._id, submittedAt: { $gte: readyAt } })
      .sort({ submittedAt: 1 }).lean();
    if (firstReview) {
      const hours = (firstReview.submittedAt.getTime() - readyAt.getTime()) / 3_600_000;
      totalPickupHours += hours;
      if (hours > 12) {
        slowPickupPRs.push({ prId: pr._id as mongoose.Types.ObjectId, number: pr.number, title: pr.title, pickupHours: hours });
      }
    }
  }
  const avgPickupHours = mergedPRs.length > 0 ? totalPickupHours / mergedPRs.length : 0;

  // R3: Top reviewer load %
  const reviews = await Review.find({
    repositoryId: repoId,
    submittedAt: { $gte: start, $lte: end },
  }).select("reviewerId").lean();

  const reviewerCounts = new Map<string, number>();
  for (const r of reviews) {
    const key = r.reviewerId.toString();
    reviewerCounts.set(key, (reviewerCounts.get(key) ?? 0) + 1);
  }
  const maxCount     = Math.max(0, ...reviewerCounts.values());
  const totalReviews = reviews.length;
  const topReviewerPct = totalReviews > 0 ? (maxCount / totalReviews) * 100 : 0;
  const topReviewerId  = [...reviewerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  // R4: Failed check rate %
  const allChecks = await CheckRun.find({
    repositoryId: repoId,
    completedAt: { $gte: start, $lte: end },
    status: "completed",
  }).select("_id conclusion pullRequestId name").lean();

  const failedChecks = allChecks.filter((c) => c.conclusion === "failure" || c.conclusion === "timed_out");
  const failedRatePct = allChecks.length > 0 ? (failedChecks.length / allChecks.length) * 100 : 0;

  // R5: Oversized PRs (> 500 lines changed)
  const oversizedPRs = await PullRequest.find({
    repositoryId: repoId,
    createdAt: { $gte: start, $lte: end },
    $expr: { $gt: [{ $add: ["$additions", "$deletions"] }, 500] },
  }).select("_id number title additions deletions").lean();

  return {
    stalePRs,
    avgPickupHours,
    slowPickupPRs,
    topReviewerPct,
    topReviewerId,
    reviews,
    failedRatePct,
    failedChecks: failedChecks.slice(0, 5),
    oversizedPRs,
  };
}

// ─── Evidence builders (per rule) ────────────────────────────────────────────

function stalePREvidenceItems(prs: { _id: mongoose.Types.ObjectId; number: number; title: string }[]): IEvidenceItem[] {
  return prs.slice(0, 5).map((pr) => ({
    entityType: "pull_request" as const,
    entityId: pr._id,
    label: `#${pr.number} ${pr.title}`,
    githubUrl: null,
  }));
}

function pickupEvidenceItems(prs: { prId: mongoose.Types.ObjectId; number: number; title: string; pickupHours: number }[]): IEvidenceItem[] {
  return prs.slice(0, 5).map((p) => ({
    entityType: "pull_request" as const,
    entityId: p.prId,
    label: `#${p.number} ${p.title} (pickup ${p.pickupHours.toFixed(1)}h)`,
    githubUrl: null,
  }));
}

function reviewEvidenceItems(reviews: { _id: mongoose.Types.ObjectId; reviewerId: mongoose.Types.ObjectId }[], topId: string): IEvidenceItem[] {
  return reviews
    .filter((r) => r.reviewerId.toString() === topId)
    .slice(0, 5)
    .map((r) => ({
      entityType: "review" as const,
      entityId: r._id,
      label: `Review by top reviewer`,
      githubUrl: null,
    }));
}

function checkRunEvidenceItems(checks: { _id: mongoose.Types.ObjectId; name: string; conclusion: string | null }[]): IEvidenceItem[] {
  return checks.slice(0, 5).map((c) => ({
    entityType: "check_run" as const,
    entityId: c._id,
    label: `${c.name}: ${c.conclusion ?? "unknown"}`,
    githubUrl: null,
  }));
}

function oversizedEvidenceItems(prs: { _id: mongoose.Types.ObjectId; number: number; title: string; additions: number; deletions: number }[]): IEvidenceItem[] {
  return prs.slice(0, 5).map((pr) => ({
    entityType: "pull_request" as const,
    entityId: pr._id,
    label: `#${pr.number} ${pr.title} (+${pr.additions}/-${pr.deletions} lines)`,
    githubUrl: null,
  }));
}

// ─── Main evaluation function ─────────────────────────────────────────────────

export async function evaluateRiskRules(
  repositoryId: string,
  windowDays = 7
): Promise<RiskEvaluationResult> {
  const repoId = new mongoose.Types.ObjectId(repositoryId);
  const { start, end } = windowBounds(windowDays);

  // Load all active rules
  const rules = await FlowRule.find({ isActive: true }).lean();
  if (rules.length === 0) throw new Error("No active flow rules found. Seed the rulebook first.");

  // Load first recommendation per rule for suggested actions
  const recommendations = await Recommendation.find({}).lean();
  const recByRule = new Map<string, string>();
  for (const rec of recommendations) {
    if (!recByRule.has(rec.ruleCode)) recByRule.set(rec.ruleCode, rec.description);
  }

  // Compute all metrics in one pass
  const m = await computeMetrics(repoId, start, end);

  // Map ruleCode → metric value and evidence items
  const ruleMetrics: Record<string, { value: number; evidence: IEvidenceItem[]; confident: boolean }> = {
    R1: {
      value: m.stalePRs.length,
      evidence: stalePREvidenceItems(m.stalePRs as { _id: mongoose.Types.ObjectId; number: number; title: string }[]),
      confident: true,
    },
    R2: {
      value: m.avgPickupHours,
      evidence: pickupEvidenceItems(m.slowPickupPRs),
      confident: m.slowPickupPRs.length > 0,
    },
    R3: {
      value: m.topReviewerPct,
      evidence: m.topReviewerId
        ? reviewEvidenceItems(
            m.reviews as { _id: mongoose.Types.ObjectId; reviewerId: mongoose.Types.ObjectId }[],
            m.topReviewerId
          )
        : [],
      confident: m.reviews.length >= 5,
    },
    R4: {
      value: m.failedRatePct,
      evidence: checkRunEvidenceItems(
        m.failedChecks as { _id: mongoose.Types.ObjectId; name: string; conclusion: string | null }[]
      ),
      confident: true,
    },
    R5: {
      value: m.oversizedPRs.length,
      evidence: oversizedEvidenceItems(
        m.oversizedPRs as { _id: mongoose.Types.ObjectId; number: number; title: string; additions: number; deletions: number }[]
      ),
      confident: true,
    },
  };

  const resultEvents: RiskEventDTO[] = [];

  for (const rule of rules) {
    const rm = ruleMetrics[rule.ruleCode];
    if (!rm) continue;

    const isTriggered =
      rule.operator === "gte"
        ? rm.value >= rule.threshold
        : rm.value <= rule.threshold;

    // Upsert RiskEvent
    const existingEvent = await RiskEvent.findOne({
      repositoryId: repoId,
      ruleCode: rule.ruleCode,
      status: "active",
    }).sort({ createdAt: -1 });

    let riskEvent: (typeof existingEvent) & { _id: mongoose.Types.ObjectId };

    if (isTriggered) {
      if (existingEvent) {
        existingEvent.metricValue   = rm.value;
        existingEvent.thresholdValue = rule.threshold;
        existingEvent.windowStart   = start;
        existingEvent.windowEnd     = end;
        await existingEvent.save();
        riskEvent = existingEvent as typeof riskEvent;
      } else {
        riskEvent = await RiskEvent.create({
          repositoryId: repoId,
          ruleCode:     rule.ruleCode,
          severity:     rule.severity,
          status:       "active",
          metricValue:  rm.value,
          thresholdValue: rule.threshold,
          windowStart:  start,
          windowEnd:    end,
        }) as typeof riskEvent;
      }

      // Build / update EvidenceCard for this event
      await EvidenceCard.findOneAndDelete({ riskEventId: riskEvent._id });
      const suggestedAction = recByRule.get(rule.ruleCode)
        ?? "Review the affected items and discuss process improvements with the team.";

      const card = await EvidenceCard.create({
        repositoryId: repoId,
        riskEventId:  riskEvent._id,
        predictionId: null,
        sourceType:   "rule_based",
        title:        `${rule.name} detected`,
        severity:     rule.severity,
        summary:      buildSummary(rule.ruleCode, rm.value, rule.threshold, rule.thresholdUnit),
        suggestedAction,
        confidence:   rm.confident ? "high" : "medium",
        limitation:   "Based on data within the selected window. Patterns may differ over longer periods.",
        evidence:     rm.evidence,
      });

      resultEvents.push(toDTO(rule, riskEvent, card, true));
    } else {
      // Resolve any active event for this rule
      if (existingEvent) {
        existingEvent.status = "resolved";
        await existingEvent.save();
      }

      // For non-triggered rules, still include them in the result (status: ok)
      resultEvents.push({
        id: existingEvent?._id.toString() ?? "",
        ruleCode: rule.ruleCode,
        ruleName: rule.name,
        ruleDescription: rule.description,
        severity: rule.severity,
        status: "resolved",
        metricValue: rm.value,
        metricLabel: METRIC_LABELS[rule.ruleCode] ?? rule.metricKey,
        thresholdValue: rule.threshold,
        thresholdUnit: rule.thresholdUnit,
        isTriggered: false,
        windowStart: start.toISOString(),
        windowEnd:   end.toISOString(),
        evidenceCard: null,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Sort: triggered first, then by severity
  resultEvents.sort((a, b) => {
    if (a.isTriggered !== b.isTriggered) return a.isTriggered ? -1 : 1;
    const sOrd: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (sOrd[a.severity] ?? 9) - (sOrd[b.severity] ?? 9);
  });

  return {
    repositoryId,
    windowDays,
    windowStart: start,
    windowEnd:   end,
    overallRisk: overallRisk(resultEvents),
    triggeredCount: resultEvents.filter((e) => e.isTriggered).length,
    events: resultEvents,
    evaluatedAt: new Date(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
  R1: "Stale PR count",
  R2: "Avg review pickup (hrs)",
  R3: "Top reviewer load (%)",
  R4: "Failed check rate (%)",
  R5: "Oversized PR count",
};

function buildSummary(code: string, value: number, threshold: number, unit: string): string {
  const fmt = unit === "%" ? `${value.toFixed(1)}%` : unit === "hours" ? `${value.toFixed(1)}h` : String(Math.round(value));
  const thr = unit === "%" ? `${threshold}%` : unit === "hours" ? `${threshold}h` : String(threshold);
  const msgs: Record<string, string> = {
    R1: `${fmt} stale PRs detected (threshold: ${thr}). Open PRs are waiting too long for review.`,
    R2: `Average review pickup time is ${fmt} (threshold: ${thr}). PRs are sitting unreviewed.`,
    R3: `Top reviewer handles ${fmt} of all reviews (threshold: ${thr}). Single point of failure risk.`,
    R4: `${fmt} of CI check runs failed (threshold: ${thr}). Unstable pipeline is slowing delivery.`,
    R5: `${fmt} oversized PRs (>${threshold} lines) detected. Large PRs are harder to review and riskier.`,
  };
  return msgs[code] ?? `Metric ${fmt} exceeded threshold ${thr}.`;
}

function toDTO(
  rule: { ruleCode: string; name: string; description: string; severity: string; threshold: number; thresholdUnit: string },
  event: { _id: mongoose.Types.ObjectId; metricValue: number; windowStart: Date; windowEnd: Date; status: string; createdAt: Date },
  card: {
    _id: mongoose.Types.ObjectId;
    title: string;
    severity: string;
    summary: string;
    suggestedAction: string;
    confidence: string;
    limitation: string;
    evidence: IEvidenceItem[];
    createdAt: Date;
  },
  isTriggered: boolean
): RiskEventDTO {
  return {
    id:              event._id.toString(),
    ruleCode:        rule.ruleCode,
    ruleName:        rule.name,
    ruleDescription: rule.description,
    severity:        rule.severity,
    status:          event.status,
    metricValue:     event.metricValue,
    metricLabel:     METRIC_LABELS[rule.ruleCode] ?? rule.ruleCode,
    thresholdValue:  rule.threshold,
    thresholdUnit:   rule.thresholdUnit,
    isTriggered,
    windowStart:     event.windowStart.toISOString(),
    windowEnd:       event.windowEnd.toISOString(),
    evidenceCard: {
      id:             card._id.toString(),
      title:          card.title,
      severity:       card.severity,
      summary:        card.summary,
      suggestedAction: card.suggestedAction,
      confidence:     card.confidence,
      limitation:     card.limitation,
      evidence:       card.evidence.map((e) => ({
        entityType: e.entityType,
        entityId:   e.entityId.toString(),
        label:      e.label,
        githubUrl:  e.githubUrl,
      })),
      createdAt: card.createdAt.toISOString(),
    },
    createdAt: event.createdAt.toISOString(),
  };
}

// ─── Fetch existing evaluated events (no recalculation) ──────────────────────

export async function getLatestRiskEvents(
  repositoryId: string,
  windowDays = 7
): Promise<RiskEvaluationResult | null> {
  const repoId = new mongoose.Types.ObjectId(repositoryId);
  const { start, end } = windowBounds(windowDays);

  const events = await RiskEvent.find({
    repositoryId: repoId,
    windowStart: { $gte: new Date(start.getTime() - 24 * 3_600_000) },
  }).sort({ createdAt: -1 }).lean();

  if (events.length === 0) return null;

  const rules = await FlowRule.find({ isActive: true }).lean();
  const ruleMap = new Map(rules.map((r) => [r.ruleCode, r]));

  const dtos: RiskEventDTO[] = [];
  for (const ev of events) {
    const rule = ruleMap.get(ev.ruleCode);
    if (!rule) continue;
    const card = await EvidenceCard.findOne({ riskEventId: ev._id }).lean();
    const isTriggered = ev.status === "active";
    dtos.push({
      id:              ev._id.toString(),
      ruleCode:        ev.ruleCode,
      ruleName:        rule.name,
      ruleDescription: rule.description,
      severity:        ev.severity,
      status:          ev.status,
      metricValue:     ev.metricValue,
      metricLabel:     METRIC_LABELS[ev.ruleCode] ?? ev.ruleCode,
      thresholdValue:  ev.thresholdValue,
      thresholdUnit:   rule.thresholdUnit,
      isTriggered,
      windowStart:     ev.windowStart.toISOString(),
      windowEnd:       ev.windowEnd.toISOString(),
      evidenceCard:    card ? {
        id:             card._id.toString(),
        title:          card.title,
        severity:       card.severity,
        summary:        card.summary,
        suggestedAction: card.suggestedAction,
        confidence:     card.confidence,
        limitation:     card.limitation,
        evidence:       card.evidence.map((e) => ({
          entityType: e.entityType,
          entityId:   e.entityId.toString(),
          label:      e.label,
          githubUrl:  e.githubUrl,
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

  return {
    repositoryId,
    windowDays,
    windowStart: start,
    windowEnd:   end,
    overallRisk: overallRisk(dtos),
    triggeredCount: dtos.filter((e) => e.isTriggered).length,
    events: dtos,
    evaluatedAt: events[0].createdAt,
  };
}
