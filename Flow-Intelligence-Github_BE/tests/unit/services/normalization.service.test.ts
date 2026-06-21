import { NormalizationService } from '../../../src/services/normalization.service';
import { Contributor } from '../../../src/models/contributor.model';
import { Issue } from '../../../src/models/issue.model';
import { Commit } from '../../../src/models/commit.model';
import { CheckRun } from '../../../src/models/checkRun.model';

jest.mock('../../../src/models/contributor.model', () => ({
  Contributor: { findOne: jest.fn(), updateOne: jest.fn(), create: jest.fn() },
}));
jest.mock('../../../src/models/issue.model', () => ({
  Issue: { findOne: jest.fn(), updateOne: jest.fn(), create: jest.fn() },
}));
jest.mock('../../../src/models/commit.model', () => ({
  Commit: { findOne: jest.fn(), updateOne: jest.fn(), create: jest.fn() },
}));
jest.mock('../../../src/models/checkRun.model', () => ({
  CheckRun: { findOne: jest.fn(), updateOne: jest.fn(), create: jest.fn() },
}));

const REPO_ID = '507f1f77bcf86cd799439011';
const PR_ID = '507f1f77bcf86cd799439099';

const asMock = (fn: unknown) => fn as jest.Mock;

describe('NormalizationService (idempotent upsert)', () => {
  let service: NormalizationService;

  beforeEach(() => {
    service = new NormalizationService();
  });

  describe('upsertContributor', () => {
    it('inserts a new contributor when none exists (keyed by repo + githubUserId)', async () => {
      asMock(Contributor.findOne).mockResolvedValue(null);

      const outcome = await service.upsertContributor(REPO_ID, {
        githubUserId: 42,
        login: 'octocat',
        type: 'User',
      });

      expect(outcome).toBe('inserted');
      expect(Contributor.create).toHaveBeenCalledTimes(1);
      expect(Contributor.updateOne).not.toHaveBeenCalled();
      // create payload carries the partitioned repositoryId
      const created = asMock(Contributor.create).mock.calls[0][0];
      expect(String(created.repositoryId)).toBe(REPO_ID);
      expect(created.githubUserId).toBe(42);
    });

    it('updates instead of duplicating when the same record is re-imported', async () => {
      const existingId = '507f1f77bcf86cd799439500';
      asMock(Contributor.findOne).mockResolvedValue({ _id: existingId });

      const outcome = await service.upsertContributor(REPO_ID, {
        githubUserId: 42,
        login: 'octocat-renamed',
        type: 'User',
      });

      expect(outcome).toBe('updated');
      expect(Contributor.updateOne).toHaveBeenCalledWith({ _id: existingId }, expect.any(Object));
      expect(Contributor.create).not.toHaveBeenCalled();
    });
  });

  describe('upsertIssue', () => {
    it('inserts a new issue keyed by githubIssueId', async () => {
      asMock(Issue.findOne).mockResolvedValue(null);

      const outcome = await service.upsertIssue(REPO_ID, {
        githubIssueId: 1001,
        number: 12,
        title: 'Bug',
        state: 'open',
        authorGithubId: 7,
        authorLogin: 'dev',
        labels: [],
        assignees: [],
        issueCreatedAt: new Date('2024-01-01'),
        issueUpdatedAt: new Date('2024-01-02'),
        issueUrl: 'https://github.com/o/r/issues/12',
      });

      expect(outcome).toBe('inserted');
      expect(Issue.findOne).toHaveBeenCalledWith({ githubIssueId: 1001 });
      expect(Issue.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('upsertCommit', () => {
    it('inserts a new commit and resolves pullRequestId to an ObjectId', async () => {
      asMock(Commit.findOne).mockResolvedValue(null);

      const outcome = await service.upsertCommit(REPO_ID, {
        githubSha: 'abcdef1234567',
        committedAt: new Date('2024-01-03'),
        pullRequestId: PR_ID,
      });

      expect(outcome).toBe('inserted');
      const created = asMock(Commit.create).mock.calls[0][0];
      expect(String(created.pullRequestId)).toBe(PR_ID);
    });

    it('leaves pullRequestId undefined when not provided', async () => {
      asMock(Commit.findOne).mockResolvedValue(null);

      await service.upsertCommit(REPO_ID, {
        githubSha: 'fedcba7654321',
        committedAt: new Date('2024-01-03'),
      });

      const created = asMock(Commit.create).mock.calls[0][0];
      expect(created.pullRequestId).toBeUndefined();
    });
  });

  describe('upsertCheckRun', () => {
    it('updates when a check run with the same githubCheckId already exists', async () => {
      const existingId = '507f1f77bcf86cd799439777';
      asMock(CheckRun.findOne).mockResolvedValue({ _id: existingId });

      const outcome = await service.upsertCheckRun(REPO_ID, {
        githubCheckId: 555,
        name: 'ci/build',
        status: 'completed',
        conclusion: 'success',
      });

      expect(outcome).toBe('updated');
      expect(CheckRun.findOne).toHaveBeenCalledWith({ githubCheckId: 555 });
      expect(CheckRun.updateOne).toHaveBeenCalledWith({ _id: existingId }, expect.any(Object));
    });
  });
});
