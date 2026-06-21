import { EvidenceCardService } from '../../../src/services/evidenceCard.service';
import { EvidenceCardRepository } from '../../../src/repositories/evidenceCard.repository';
import { GitHubRepository } from '../../../src/modules/github/models/githubRepository.model';
import { PullRequest } from '../../../src/modules/github/models/pullRequest.model';
import { AppError } from '../../../src/utils/AppError';

jest.mock('../../../src/modules/github/models/githubRepository.model', () => ({
  GitHubRepository: { findById: jest.fn() },
}));
jest.mock('../../../src/modules/github/models/pullRequest.model', () => ({
  PullRequest: { findById: jest.fn() },
}));
jest.mock('../../../src/models/issue.model', () => ({ Issue: { findById: jest.fn() } }));
jest.mock('../../../src/models/commit.model', () => ({ Commit: { findById: jest.fn() } }));
jest.mock('../../../src/models/checkRun.model', () => ({ CheckRun: { findById: jest.fn() } }));

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

    it('falls back to the rulebook recommendation for the rule code', async () => {
      (PullRequest.findById as jest.Mock).mockResolvedValue(mockPr());

      await service.generateFromRiskEvent(REPO_ID, baseInput); // R2
      const card = (repo.create as jest.Mock).mock.calls[0][0];
      expect(card.suggestedAction).toMatch(/backup reviewer/i);
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
  });
});
