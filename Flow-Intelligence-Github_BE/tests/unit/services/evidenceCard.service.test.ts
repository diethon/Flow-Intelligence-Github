import { EvidenceCardService } from '../../../src/services/evidenceCard.service';
import { EvidenceCardRepository } from '../../../src/repositories/evidenceCard.repository';
import { GitHubRepository, PullRequest } from '../../../src/modules/github/models';
import { RiskEvent } from '../../../src/models/RiskEvent';
import { FlowRule } from '../../../src/models/FlowRule';
import { Recommendation } from '../../../src/models/Recommendation';
import { DataQualityWarning } from '../../../src/models/DataQualityWarning';
import { AppError } from '../../../src/utils/AppError';

jest.mock('../../../src/modules/github/models', () => ({
  GitHubRepository: { findById: jest.fn() },
  PullRequest: { findById: jest.fn() },
}));
jest.mock('../../../src/models/issue.model', () => ({ Issue: { findById: jest.fn() } }));
jest.mock('../../../src/models/commit.model', () => ({ Commit: { findById: jest.fn() } }));
jest.mock('../../../src/models/checkRun.model', () => ({ CheckRun: { findById: jest.fn() } }));
jest.mock('../../../src/models/RiskEvent', () => ({ RiskEvent: { findById: jest.fn() } }));
jest.mock('../../../src/models/FlowRule', () => ({ FlowRule: { findOne: jest.fn() } }));
jest.mock('../../../src/models/Recommendation', () => ({ Recommendation: { findOne: jest.fn() } }));
jest.mock('../../../src/models/DataQualityWarning', () => ({ DataQualityWarning: { findOne: jest.fn() } }));

// Default: no rulebook recommendation and no unresolved data-quality warning.
const leanOf = (value: unknown) => ({ lean: () => Promise.resolve(value) });

const REPO_ID = '507f1f77bcf86cd799439011';
const PR_ID = '507f1f77bcf86cd799439099';
const CARD_ID = '507f1f77bcf86cd799439222';

const mockPr = () => ({
  _id: PR_ID,
  number: 42,
  prUrl: 'https://github.com/o/r/pull/42',
  title: 'Add feature',
});

describe('EvidenceCardService', () => {
  let repo: jest.Mocked<EvidenceCardRepository>;
  let service: EvidenceCardService;

  beforeEach(() => {
    (GitHubRepository.findById as jest.Mock).mockResolvedValue({ _id: REPO_ID });
    (Recommendation.findOne as jest.Mock).mockReturnValue(leanOf(null));
    (DataQualityWarning.findOne as jest.Mock).mockReturnValue(leanOf(null));
    repo = {
      create: jest.fn().mockImplementation((doc) => Promise.resolve({ _id: CARD_ID, ...doc })),
      findById: jest.fn(),
      findMany: jest.fn(),
    } as unknown as jest.Mocked<EvidenceCardRepository>;
    service = new EvidenceCardService(repo);
  });

  describe('generateFromRiskEvent', () => {
    const baseInput = {
      ruleCode: 'R2',
      severity: 'high' as const,
      affectedEntityRefs: [{ entityType: 'pull_request' as const, entityId: PR_ID }],
    };

    it('creates a card with all required fields when evidence resolves', async () => {
      (PullRequest.findById as jest.Mock).mockResolvedValue(mockPr());

      const res = await service.generateFromRiskEvent(REPO_ID, baseInput);

      expect(res.success).toBe(true);
      expect(repo.create).toHaveBeenCalledTimes(1);
      const card = (repo.create as jest.Mock).mock.calls[0][0];
      expect(card.sourceType).toBe('risk_event');
      expect(card.evidence).toHaveLength(1);
      expect(card.evidence[0]).toMatchObject({ entityType: 'pull_request', sourceLabel: 'PR #42' });
      // Definition of Done: every card carries these four fields.
      expect(card.suggestedAction).toBeTruthy();
      expect(card.confidence).toBeTruthy();
      expect(card.limitation).toBeTruthy();
    });

    it('falls back to the built-in recommendation when the rulebook has none', async () => {
      (PullRequest.findById as jest.Mock).mockResolvedValue(mockPr());

      await service.generateFromRiskEvent(REPO_ID, baseInput); // R2
      const card = (repo.create as jest.Mock).mock.calls[0][0];
      expect(card.suggestedAction).toMatch(/backup reviewer/i);
    });

    it('reuses the rulebook recommendation when one exists', async () => {
      (PullRequest.findById as jest.Mock).mockResolvedValue(mockPr());
      (Recommendation.findOne as jest.Mock).mockReturnValue(
        leanOf({ description: 'Rotate reviewers weekly per the team playbook.' })
      );

      await service.generateFromRiskEvent(REPO_ID, baseInput);
      const card = (repo.create as jest.Mock).mock.calls[0][0];
      expect(card.suggestedAction).toBe('Rotate reviewers weekly per the team playbook.');
    });

    it('derives high confidence when there is no data-quality warning', async () => {
      (PullRequest.findById as jest.Mock).mockResolvedValue(mockPr());

      await service.generateFromRiskEvent(REPO_ID, baseInput);
      const card = (repo.create as jest.Mock).mock.calls[0][0];
      expect(card.confidence).toBe('high');
    });

    it('lowers confidence to medium when a relevant data-quality warning is unresolved', async () => {
      (PullRequest.findById as jest.Mock).mockResolvedValue(mockPr());
      (DataQualityWarning.findOne as jest.Mock).mockReturnValue(
        leanOf({ code: 'no_review_data', resolvedAt: null })
      );

      await service.generateFromRiskEvent(REPO_ID, baseInput); // R2 → no_review_data
      const card = (repo.create as jest.Mock).mock.calls[0][0];
      expect(card.confidence).toBe('medium');
    });

    it('appends a rule-specific caveat to the limitation', async () => {
      (PullRequest.findById as jest.Mock).mockResolvedValue(mockPr());

      await service.generateFromRiskEvent(REPO_ID, baseInput); // R2
      const card = (repo.create as jest.Mock).mock.calls[0][0];
      expect(card.limitation).toMatch(/received a review/i);
    });

    it('NEVER creates a card when no evidence can be resolved', async () => {
      (PullRequest.findById as jest.Mock).mockResolvedValue(null); // PR not found

      await expect(service.generateFromRiskEvent(REPO_ID, baseInput)).rejects.toMatchObject({
        statusCode: 422,
        code: 'EVIDENCE_REQUIRED',
      });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('throws when the repository does not exist', async () => {
      (GitHubRepository.findById as jest.Mock).mockResolvedValue(null);
      await expect(service.generateFromRiskEvent(REPO_ID, baseInput)).rejects.toThrow(AppError);
    });
  });

  describe('generateFromPrediction', () => {
    it('does not create a card for a Low-risk prediction', async () => {
      await expect(
        service.generateFromPrediction(REPO_ID, {
          pullRequestId: PR_ID,
          probability: 0.2,
          riskLabel: 'Low',
        })
      ).rejects.toMatchObject({ statusCode: 422, code: 'EVIDENCE_REQUIRED' });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates a high-severity, high-confidence card for a High-risk prediction', async () => {
      (PullRequest.findById as jest.Mock).mockResolvedValue(mockPr());

      await service.generateFromPrediction(REPO_ID, {
        pullRequestId: PR_ID,
        probability: 0.9,
        riskLabel: 'High',
        modelVersion: 'v1',
      });

      const card = (repo.create as jest.Mock).mock.calls[0][0];
      expect(card.sourceType).toBe('prediction');
      expect(card.severity).toBe('high');
      expect(card.confidence).toBe('high'); // probability >= 0.75
      expect(card.evidence).toHaveLength(1);
    });

    it('uses medium confidence when probability is below 0.75', async () => {
      (PullRequest.findById as jest.Mock).mockResolvedValue(mockPr());

      await service.generateFromPrediction(REPO_ID, {
        pullRequestId: PR_ID,
        probability: 0.6,
        riskLabel: 'Medium',
      });

      const card = (repo.create as jest.Mock).mock.calls[0][0];
      expect(card.severity).toBe('medium');
      expect(card.confidence).toBe('medium');
    });

    it('does not create a card when the pull request cannot be found', async () => {
      (PullRequest.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.generateFromPrediction(REPO_ID, {
          pullRequestId: PR_ID,
          probability: 0.9,
          riskLabel: 'High',
        })
      ).rejects.toMatchObject({ statusCode: 422, code: 'EVIDENCE_REQUIRED' });
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns cards with pagination metadata', async () => {
      (repo.findMany as jest.Mock).mockResolvedValue({ data: [{ _id: CARD_ID }], total: 1 });

      const res = await service.list(REPO_ID, { page: 1, limit: 20 });

      expect(res.success).toBe(true);
      expect(res.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(repo.findMany).toHaveBeenCalledWith(
        { repositoryId: REPO_ID, severity: undefined, sourceType: undefined },
        { page: 1, limit: 20 }
      );
    });

    it('passes severity and sourceType filters through', async () => {
      (repo.findMany as jest.Mock).mockResolvedValue({ data: [], total: 0 });

      await service.list(REPO_ID, { page: 2, limit: 5, severity: 'high', sourceType: 'prediction' });

      expect(repo.findMany).toHaveBeenCalledWith(
        { repositoryId: REPO_ID, severity: 'high', sourceType: 'prediction' },
        { page: 2, limit: 5 }
      );
    });
  });

  describe('getById', () => {
    it('returns the card when found', async () => {
      (repo.findById as jest.Mock).mockResolvedValue({ _id: CARD_ID, title: 'x' });
      const res = await service.getById(CARD_ID);
      expect(res.data).toMatchObject({ _id: CARD_ID });
    });

    it('throws 404 when the card does not exist', async () => {
      (repo.findById as jest.Mock).mockResolvedValue(null);
      await expect(service.getById(CARD_ID)).rejects.toMatchObject({
        statusCode: 404,
        code: 'EVIDENCE_CARD_NOT_FOUND',
      });
    });

    it('enriches a rule-based card with linked risk-event drivers', async () => {
      (repo.findById as jest.Mock).mockResolvedValue({
        _id: CARD_ID,
        sourceType: 'risk_event',
        riskEventId: 'evt-1',
        toObject() {
          return { _id: CARD_ID, sourceType: 'risk_event', riskEventId: 'evt-1' };
        },
      });
      (RiskEvent.findById as jest.Mock).mockReturnValue({
        lean: () =>
          Promise.resolve({
            ruleCode: 'R3',
            metricValue: 100,
            thresholdValue: 70,
            status: 'active',
            severity: 'high',
            windowStart: new Date('2026-07-01'),
            windowEnd: new Date('2026-07-08'),
          }),
      });
      (FlowRule.findOne as jest.Mock).mockReturnValue({
        lean: () =>
          Promise.resolve({ name: 'Reviewer Concentration', thresholdUnit: 'pct', operator: 'gte' }),
      });

      const res = await service.getById(CARD_ID);

      expect((res.data as { riskEvent?: unknown }).riskEvent).toMatchObject({
        ruleCode: 'R3',
        ruleName: 'Reviewer Concentration',
        metricValue: 100,
        thresholdValue: 70,
        thresholdUnit: 'pct',
        operator: 'gte',
        status: 'active',
      });
    });

    it('does not attach risk drivers for prediction cards', async () => {
      (repo.findById as jest.Mock).mockResolvedValue({
        _id: CARD_ID,
        sourceType: 'prediction',
        toObject() {
          return { _id: CARD_ID, sourceType: 'prediction' };
        },
      });

      const res = await service.getById(CARD_ID);

      expect((res.data as { riskEvent?: unknown }).riskEvent).toBeUndefined();
      expect(RiskEvent.findById as jest.Mock).not.toHaveBeenCalled();
    });
  });
});
