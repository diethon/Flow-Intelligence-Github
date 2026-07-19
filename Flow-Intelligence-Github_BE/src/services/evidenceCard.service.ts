import mongoose from 'mongoose';
import { EvidenceCardRepository, EvidenceCardFilter } from '../repositories/evidenceCard.repository';
import { IEvidenceItem } from '../models/evidenceCard.model';
import { Issue } from '../models/issue.model';
import { Commit } from '../models/commit.model';
import { Review } from '../models/Review';
import { CheckRun } from '../models/checkRun.model';
import { PullRequest, GitHubRepository } from '../modules/github/models/index.js';
import { RiskEvent } from '../models/RiskEvent';
import { FlowRule } from '../models/FlowRule';
import type { RuleCode } from '../models/FlowRule';
import { Recommendation } from '../models/Recommendation';
import { DataQualityWarning, DataQualityCode } from '../models/DataQualityWarning';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../types';
import { RiskEventInput, PredictionInput, EvidenceListQuery } from '../dto/evidence.dto';

/**
 * Safe, process-oriented recommendation catalog (no HR/performance language).
 * Maps Flow Risk Rulebook codes R1-R5 to a default suggested action.
 */
const RECOMMENDATION_BY_RULE: Record<string, string> = {
  R1: 'Request an update or convert stale PRs to draft, and close obsolete PRs.',
  R2: 'Assign a backup reviewer and set a review pickup SLA.',
  R3: 'Distribute review ownership and rotate reviewers.',
  R4: 'Inspect failing checks, rerun them, and prioritize CI fixes.',
  R5: 'Split the PR into smaller, focused changes for easier review.',
  W1: 'Review workload distribution across the team and encourage healthier working-hours boundaries.',
};

const DEFAULT_LIMITATION = 'Only GitHub PR/review metadata was analyzed.';

/** Rule-specific caveat appended to the limitation, to head off false positives. */
const RULE_CAVEAT: Record<string, string> = {
  R1: 'Includes draft/WIP PRs that may be intentionally left open.',
  R2: 'Counts only PRs that received a review; automated reviews are included.',
  R3: 'Small teams naturally concentrate reviews on fewer people.',
  R4: 'Counts required checks only; flaky tests can cause false positives.',
  R5: 'Generated or vendored files can inflate line counts.',
  W1: 'Off-hours are computed in UTC without timezone normalization; contributors in other timezones may be miscounted.',
};

/** Which unresolved data-quality warning weakens confidence for each rule. */
const RULE_WARNING_CODE: Record<string, DataQualityCode> = {
  R1: 'no_pr_data',
  R2: 'no_review_data',
  R3: 'no_review_data',
  R4: 'missing_checks_permission',
  R5: 'no_pr_data',
};

export class EvidenceCardService {
  constructor(private readonly repo: EvidenceCardRepository = new EvidenceCardRepository()) {}

  private async assertRepositoryExists(repositoryId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(repositoryId)) {
      throw new AppError('Invalid repository id', 400, 'INVALID_REPOSITORY_ID', { repositoryId });
    }
    const repo = await GitHubRepository.findById(repositoryId);
    if (!repo) {
      throw new AppError('Repository not found', 404, 'REPOSITORY_NOT_FOUND', { repositoryId });
    }
  }

  /** Resolve affected entity references into display-ready evidence items. */
  private async resolveEvidence(
    refs: { entityType: string; entityId: string }[]
  ): Promise<IEvidenceItem[]> {
    const items: IEvidenceItem[] = [];

    for (const ref of refs) {
      const oid = new mongoose.Types.ObjectId(ref.entityId);
      switch (ref.entityType) {
        case 'pull_request': {
          const pr = await PullRequest.findById(oid);
          if (pr) {
            items.push({
              entityType: 'pull_request',
              entityId: pr._id,
              sourceLabel: `PR #${pr.number}`,
              sourceUrl: pr.prUrl,
              summary: pr.title,
            });
          }
          break;
        }
        case 'issue': {
          const issue = await Issue.findById(oid);
          if (issue) {
            items.push({
              entityType: 'issue',
              entityId: issue._id,
              sourceLabel: `Issue #${issue.number}`,
              sourceUrl: issue.issueUrl,
              summary: issue.title,
            });
          }
          break;
        }
        case 'commit': {
          const commit = await Commit.findById(oid);
          if (commit) {
            items.push({
              entityType: 'commit',
              entityId: commit._id,
              sourceLabel: `Commit ${String(commit.githubSha).slice(0, 7)}`,
              sourceUrl: '',
              summary: commit.message || 'Commit metadata',
            });
          }
          break;
        }
        case 'check_run': {
          const check = await CheckRun.findById(oid);
          if (check) {
            items.push({
              entityType: 'check_run',
              entityId: check._id,
              sourceLabel: `Check: ${check.name}`,
              sourceUrl: check.detailsUrl || '',
              summary: check.conclusion ? `Conclusion: ${check.conclusion}` : `Status: ${check.status}`,
            });
          }
          break;
        }
        case 'review': {
          const review = await Review.findById(oid);
          if (review) {
            // Reviewer identity is intentionally masked (no real login in evidence).
            const pr = await PullRequest.findById(review.pullRequestId);
            items.push({
              entityType: 'review',
              entityId: review._id,
              sourceLabel: pr ? `Review on PR #${pr.number}` : 'Review',
              sourceUrl: pr?.prUrl || '',
              summary: `Review submitted (${review.state})`,
            });
          }
          break;
        }
      }
    }

    return items;
  }

  /**
   * Build the Evidence Card shape from a rule-based risk event WITHOUT persisting
   * it. Guardrail: throws if no evidence resolves (a card with no evidence is
   * never produced). Used both by {@link generateFromRiskEvent} (which persists)
   * and by signals that render on their own page and must NOT pollute the shared
   * Evidence list (e.g. Workload Risk / burnout — surfaced only on its own page).
   */
  async buildRiskEventCard(repositoryId: string, input: RiskEventInput) {
    await this.assertRepositoryExists(repositoryId);

    const evidence = await this.resolveEvidence(input.affectedEntityRefs);
    if (evidence.length === 0) {
      throw new AppError(
        'Evidence Card not created: no resolvable evidence for this risk event.',
        422,
        'EVIDENCE_REQUIRED',
        { ruleCode: input.ruleCode }
      );
    }

    // Reuse the rulebook recommendation (owned by the metrics module) before
    // falling back to the built-in default.
    const recommendation = await Recommendation.findOne({ ruleCode: input.ruleCode as RuleCode }).lean();
    const suggestedAction =
      input.suggestedAction ||
      recommendation?.description ||
      RECOMMENDATION_BY_RULE[input.ruleCode] ||
      'Review the affected items.';

    const confidence = input.confidence || (await this.deriveConfidence(repositoryId, input.ruleCode));

    const caveat = RULE_CAVEAT[input.ruleCode];
    const limitation =
      input.limitation || (caveat ? `${DEFAULT_LIMITATION} ${caveat}` : DEFAULT_LIMITATION);

    return {
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
      sourceType: 'risk_event' as const,
      title: input.title || `Flow risk detected (${input.ruleCode})`,
      severity: input.severity,
      summary:
        input.summary ||
        (input.metricValue !== undefined && input.thresholdValue !== undefined
          ? `Metric ${input.metricValue} crossed threshold ${input.thresholdValue}.`
          : `Rule ${input.ruleCode} triggered.`),
      evidence,
      suggestedAction,
      confidence,
      limitation,
    };
  }

  /**
   * UC-15: Generate and persist an Evidence Card from a rule-based risk event.
   * Guardrail: a card with no resolvable evidence is never created.
   */
  async generateFromRiskEvent(
    repositoryId: string,
    input: RiskEventInput
  ): Promise<ApiResponse<unknown>> {
    const cardData = await this.buildRiskEventCard(repositoryId, input);
    const card = await this.repo.create(cardData);
    return { success: true, message: 'Evidence Card created', data: card };
  }

  /**
   * Confidence from data completeness: an unresolved data-quality warning for the
   * rule's metric lowers confidence to "medium". Otherwise "high". Never "low" —
   * a card that weak would not have been created.
   */
  private async deriveConfidence(
    repositoryId: string,
    ruleCode: string
  ): Promise<'high' | 'medium'> {
    const warnCode = RULE_WARNING_CODE[ruleCode];
    if (warnCode) {
      const warn = await DataQualityWarning.findOne({
        repositoryId: new mongoose.Types.ObjectId(repositoryId),
        code: warnCode,
        resolvedAt: null,
      }).lean();
      if (warn) return 'medium';
    }
    return 'high';
  }

  /**
   * UC-15: Generate an Evidence Card from a high-risk ML prediction.
   * Guardrail: low-risk predictions do not produce cards.
   */
  async generateFromPrediction(
    repositoryId: string,
    input: PredictionInput
  ): Promise<ApiResponse<unknown>> {
    await this.assertRepositoryExists(repositoryId);

    if (input.riskLabel === 'Low') {
      throw new AppError(
        'Evidence Card not created: prediction is low risk.',
        422,
        'EVIDENCE_REQUIRED',
        { pullRequestId: input.pullRequestId }
      );
    }

    const evidence = await this.resolveEvidence([
      { entityType: 'pull_request', entityId: input.pullRequestId },
    ]);
    if (evidence.length === 0) {
      throw new AppError(
        'Evidence Card not created: pull request not found.',
        422,
        'EVIDENCE_REQUIRED',
        { pullRequestId: input.pullRequestId }
      );
    }

    const severity = input.riskLabel === 'High' ? 'high' : 'medium';
    const confidence = input.probability >= 0.75 ? 'high' : 'medium';

    const card = await this.repo.create({
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
      predictionId: input.predictionId
        ? new mongoose.Types.ObjectId(input.predictionId)
        : undefined,
      sourceType: 'prediction',
      title: `${evidence[0].sourceLabel} is likely to be delayed`,
      severity,
      summary: `Predicted delay probability ${(input.probability * 100).toFixed(0)}% (${input.riskLabel} risk).`,
      evidence,
      suggestedAction: RECOMMENDATION_BY_RULE.R2,
      confidence,
      limitation:
        input.limitation ||
        `Prediction from model ${input.modelVersion || 'unknown'}; based on GitHub PR/review metadata only.`,
    });

    return { success: true, message: 'Evidence Card created', data: card };
  }

  /** UC-16: list Evidence Cards for a repository. */
  async list(repositoryId: string, query: EvidenceListQuery): Promise<ApiResponse<unknown>> {
    await this.assertRepositoryExists(repositoryId);

    const filter: EvidenceCardFilter = {
      repositoryId,
      severity: query.severity,
      sourceType: query.sourceType,
    };
    const { data, total } = await this.repo.findMany(filter, {
      page: query.page,
      limit: query.limit,
    });

    return {
      success: true,
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * UC-16: Evidence Card detail with resolved evidence for drill-down.
   * For rule-based cards, also surface the linked RiskEvent as "risk drivers"
   * (metric vs threshold, evaluation window, status) so the detail page can
   * explain *why* the rule triggered — symmetric to prediction cards' ML details.
   */
  async getById(id: string): Promise<ApiResponse<unknown>> {
    const card = await this.repo.findById(id);
    if (!card) {
      throw new AppError('Evidence Card not found', 404, 'EVIDENCE_CARD_NOT_FOUND', { id });
    }

    const maybeDoc = card as { toObject?: () => Record<string, unknown> };
    const data: Record<string, unknown> =
      typeof maybeDoc.toObject === 'function'
        ? maybeDoc.toObject()
        : { ...(card as Record<string, unknown>) };

    if (card.sourceType === 'risk_event' && card.riskEventId) {
      const event = await RiskEvent.findById(card.riskEventId).lean();
      if (event) {
        const rule = await FlowRule.findOne({ ruleCode: event.ruleCode }).lean();
        data.riskEvent = {
          ruleCode: event.ruleCode,
          ruleName: rule?.name ?? event.ruleCode,
          metricValue: event.metricValue,
          thresholdValue: event.thresholdValue,
          thresholdUnit: rule?.thresholdUnit ?? '',
          operator: rule?.operator ?? 'gte',
          status: event.status,
          severity: event.severity,
          windowStart: event.windowStart,
          windowEnd: event.windowEnd,
        };
      }
    }

    return { success: true, data };
  }
}

export const evidenceCardService = new EvidenceCardService();
