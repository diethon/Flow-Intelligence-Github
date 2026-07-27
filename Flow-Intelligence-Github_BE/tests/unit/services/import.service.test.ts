import { ImportService } from '../../../src/services/import.service';
import { NormalizationService } from '../../../src/services/normalization.service';
import { GitHubRepository } from '../../../src/modules/github/models';
import { AppError } from '../../../src/utils/AppError';

jest.mock('../../../src/modules/github/models', () => ({
  GitHubRepository: { findById: jest.fn() },
}));

const REPO_ID = '507f1f77bcf86cd799439011';

const validIssue = (overrides: Record<string, unknown> = {}) => ({
  githubIssueId: 1,
  number: 1,
  title: 'A real issue',
  state: 'open',
  authorGithubId: 7,
  authorLogin: 'dev',
  issueCreatedAt: '2024-01-01T00:00:00Z',
  issueUpdatedAt: '2024-01-02T00:00:00Z',
  issueUrl: 'https://github.com/o/r/issues/1',
  ...overrides,
});

describe('ImportService', () => {
  let normalization: jest.Mocked<NormalizationService>;
  let service: ImportService;

  beforeEach(() => {
    (GitHubRepository.findById as jest.Mock).mockResolvedValue({ _id: REPO_ID });
    normalization = {
      upsertContributor: jest.fn().mockResolvedValue('inserted'),
      upsertIssue: jest.fn().mockResolvedValue('inserted'),
      upsertCommit: jest.fn().mockResolvedValue('inserted'),
      upsertCheckRun: jest.fn().mockResolvedValue('inserted'),
    } as unknown as jest.Mocked<NormalizationService>;
    service = new ImportService(normalization);
  });

  describe('repository guard', () => {
    it('throws on an invalid repository id', async () => {
      await expect(service.importJson('not-an-id', { issues: [] })).rejects.toThrow(AppError);
      expect(GitHubRepository.findById).not.toHaveBeenCalled();
    });

    it('throws when the repository does not exist', async () => {
      (GitHubRepository.findById as jest.Mock).mockResolvedValue(null);
      await expect(service.importJson(REPO_ID, { issues: [validIssue()] })).rejects.toMatchObject({
        statusCode: 404,
        code: 'REPOSITORY_NOT_FOUND',
      });
    });
  });

  describe('valid import', () => {
    it('counts inserted/updated per entity and reports no errors', async () => {
      (normalization.upsertIssue as jest.Mock)
        .mockResolvedValueOnce('inserted')
        .mockResolvedValueOnce('updated');

      const res = await service.importJson(REPO_ID, {
        issues: [validIssue({ githubIssueId: 1, number: 1 }), validIssue({ githubIssueId: 2, number: 2 })],
      });

      expect(res.success).toBe(true);
      expect(res.data).toMatchObject({
        totalRows: 2,
        inserted: 1,
        updated: 1,
        skipped: 0,
      });
      expect(res.data!.errors).toHaveLength(0);
      expect(res.data!.byEntity.issues).toEqual({ inserted: 1, updated: 1, skipped: 0, errors: 0 });
      expect(normalization.upsertIssue).toHaveBeenCalledTimes(2);
    });
  });

  describe('idempotency', () => {
    it('re-importing the same row updates instead of inserting (no duplicate)', async () => {
      (normalization.upsertIssue as jest.Mock).mockResolvedValue('inserted');
      const first = await service.importJson(REPO_ID, { issues: [validIssue()] });
      expect(first.data).toMatchObject({ inserted: 1, updated: 0 });

      // Second pass: normalization now reports the existing record as updated.
      (normalization.upsertIssue as jest.Mock).mockResolvedValue('updated');
      const second = await service.importJson(REPO_ID, { issues: [validIssue()] });
      expect(second.data).toMatchObject({ inserted: 0, updated: 1, skipped: 0 });
    });
  });

  describe('per-row validation', () => {
    it('reports the failing row with its index and field, and still imports valid siblings', async () => {
      const res = await service.importJson(REPO_ID, {
        issues: [
          validIssue({ githubIssueId: 1, number: 1 }),
          validIssue({ githubIssueId: 2, number: 2, title: '' }), // invalid: title empty
        ],
      });

      expect(res.data!.totalRows).toBe(2);
      expect(res.data!.inserted).toBe(1); // valid sibling imported
      expect(res.data!.skipped).toBe(1);

      const titleError = res.data!.errors.find((e) => e.field === 'title');
      expect(titleError).toMatchObject({ entityType: 'issues', index: 1, field: 'title' });
      // only the valid row reached the upsert layer
      expect(normalization.upsertIssue).toHaveBeenCalledTimes(1);
      expect(res.message).toMatch(/row error/i);
    });

    it('reports a missing required field with the field path', async () => {
      const { title: _omitTitle, ...noTitle } = validIssue();
      const res = await service.importJson(REPO_ID, { issues: [noTitle] });

      expect(res.data!.inserted).toBe(0);
      expect(res.data!.skipped).toBe(1);
      expect(res.data!.errors[0]).toMatchObject({ entityType: 'issues', index: 0, field: 'title' });
    });
  });

  describe('upsert failure handling', () => {
    it('records a row as skipped/errored when the upsert throws', async () => {
      (normalization.upsertIssue as jest.Mock).mockRejectedValue(new Error('duplicate key'));

      const res = await service.importJson(REPO_ID, { issues: [validIssue()] });

      expect(res.data!.skipped).toBe(1);
      expect(res.data!.inserted).toBe(0);
      expect(res.data!.errors[0]).toMatchObject({ entityType: 'issues', index: 0, message: 'duplicate key' });
    });
  });

  describe('multiple entity types', () => {
    it('processes contributors and commits in one payload', async () => {
      const res = await service.importJson(REPO_ID, {
        contributors: [{ githubUserId: 9, login: 'octocat' }],
        commits: [{ githubSha: 'abcdef1', committedAt: '2024-01-01T00:00:00Z' }],
      });

      expect(res.data!.totalRows).toBe(2);
      expect(res.data!.inserted).toBe(2);
      expect(normalization.upsertContributor).toHaveBeenCalledTimes(1);
      expect(normalization.upsertCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe('CSV import (UC-20)', () => {
    const issuesCsv = [
      'githubIssueId,number,title,state,authorGithubId,authorLogin,labels,assignees,issueCreatedAt,issueUpdatedAt,issueUrl',
      '1,1,A real issue,open,7,dev,bug;ui,alice;bob,2024-01-01T00:00:00Z,2024-01-02T00:00:00Z,https://github.com/o/r/issues/1',
    ].join('\n');

    it('coerces numeric and array cells and upserts the row', async () => {
      const res = await service.importCsv(REPO_ID, 'issues', issuesCsv);

      expect(res.data).toMatchObject({ totalRows: 1, inserted: 1, skipped: 0 });
      expect(res.data!.errors).toHaveLength(0);
      const arg = (normalization.upsertIssue as jest.Mock).mock.calls[0][1];
      expect(arg.githubIssueId).toBe(1); // number, not "1"
      expect(arg.labels).toEqual(['bug', 'ui']); // split on ';'
      expect(arg.assignees).toEqual(['alice', 'bob']);
    });

    it('reports per-row/per-field errors and still imports valid rows', async () => {
      const csv = [
        'githubIssueId,number,title,state,authorGithubId,authorLogin,issueCreatedAt,issueUpdatedAt,issueUrl',
        '1,1,Valid,open,7,dev,2024-01-01T00:00:00Z,2024-01-02T00:00:00Z,https://github.com/o/r/issues/1',
        '2,2,,open,7,dev,2024-01-01T00:00:00Z,2024-01-02T00:00:00Z,https://github.com/o/r/issues/2', // empty title
      ].join('\n');

      const res = await service.importCsv(REPO_ID, 'issues', csv);

      expect(res.data!.totalRows).toBe(2);
      expect(res.data!.inserted).toBe(1);
      expect(res.data!.skipped).toBe(1);
      expect(res.data!.errors.find((e) => e.field === 'title')).toMatchObject({ index: 1 });
    });

    it('is idempotent: re-importing the same CSV updates instead of duplicating', async () => {
      (normalization.upsertIssue as jest.Mock).mockResolvedValue('inserted');
      const first = await service.importCsv(REPO_ID, 'issues', issuesCsv);
      expect(first.data).toMatchObject({ inserted: 1, updated: 0 });

      (normalization.upsertIssue as jest.Mock).mockResolvedValue('updated');
      const second = await service.importCsv(REPO_ID, 'issues', issuesCsv);
      expect(second.data).toMatchObject({ inserted: 0, updated: 1, skipped: 0 });
    });

    it('rejects an invalid entity type at the service boundary via empty parse', async () => {
      // commits CSV missing required committedAt → row error, no crash
      const csv = ['githubSha\nabcdef1'].join('\n');
      const res = await service.importCsv(REPO_ID, 'commits', csv);
      expect(res.data!.skipped).toBe(1);
      expect(res.data!.errors[0]).toMatchObject({ entityType: 'commits', index: 0 });
    });
  });
});
