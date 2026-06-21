import mongoose from 'mongoose';
import { EvidenceCardRepository, EvidenceCardFilter } from '../repositories/evidenceCard.repository';
import { IEvidenceItem } from '../models/evidenceCard.model';
import { Issue } from '../models/issue.model';
import { Commit } from '../models/commit.model';
import { CheckRun } from '../models/checkRun.model';
import { PullRequest, GitHubRepository } from '../modules/github/models/index.js';
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
};

const DEFAULT_LIMITATION = 'Only GitHub PR/review metadata was analyzed.';

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
      }
    }

    return items;
  }

  /**
   * UC-15: Generate an Evidence Card from a rule-based risk event.
   * Guardrail: a card with no resolvable evidence is never created.
   */
  async generateFromRiskEvent(
    repositoryId: string,
    input: RiskEventInput
  ): Promise<ApiResponse<unknown>> {
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

    const card = await this.repo.create({
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
      sourceType: 'risk_event',
      title: input.title || `Flow risk detected (${input.ruleCode})`,
      severity: input.severity,
      summary:
        input.summary ||
        (input.metricValue !== undefined && input.thresholdValue !== undefined
          ? `Metric ${input.metricValue} crossed threshold ${input.thresholdValue}.`
          : `Rule ${input.ruleCode} triggered.`),
      evidence,
      suggestedAction:
        input.suggestedAction || RECOMMENDATION_BY_RULE[input.ruleCode] || 'Review the affected items.',
      confidence: input.confidence || 'medium',
      limitation: input.limitation || DEFAULT_LIMITATION,
    });

    return { success: true, message: 'Evidence Card created', data: card };
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

  /** UC-16: Evidence Card detail with resolved evidence for drill-down. */
  async getById(id: string): Promise<ApiResponse<unknown>> {
    const card = await this.repo.findById(id);
    if (!card) {
      throw new AppError('Evidence Card not found', 404, 'EVIDENCE_CARD_NOT_FOUND', { id });
    }
    return { success: true, data: card };
  }
}

export const evidenceCardService = new EvidenceCardService();
