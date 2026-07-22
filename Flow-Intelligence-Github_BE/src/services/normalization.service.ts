import mongoose from 'mongoose';
import { Contributor } from '../models/contributor.model';
import { Issue } from '../models/issue.model';
import { Commit } from '../models/commit.model';
import { CheckRun } from '../models/checkRun.model';
import { ContributorImport, IssueImport, CommitImport, CheckRunImport } from '../dto/import.dto';

export type UpsertOutcome = 'inserted' | 'updated';

const toObjectId = (id?: string) =>
  id && mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : undefined;

/**
 * Normalization service: converts validated normalized DTOs into stored
 * entities using idempotent upsert keyed by GitHub source id. Re-importing the
 * same record updates it instead of creating a duplicate. Shared by the sample
 * import flow (and reusable by sync recompute).
 */
export class NormalizationService {
  private async upsert(
    model: { findOne: Function; updateOne: Function; create: Function },
    filter: Record<string, unknown>,
    data: Record<string, unknown>
  ): Promise<UpsertOutcome> {
    const existing = await model.findOne(filter);
    if (existing) {
      await model.updateOne({ _id: existing._id }, data);
      return 'updated';
    }
    await model.create(data);
    return 'inserted';
  }

  async upsertContributor(repositoryId: string, row: ContributorImport): Promise<UpsertOutcome> {
    const repoId = new mongoose.Types.ObjectId(repositoryId);
    return this.upsert(
      Contributor,
      { repositoryId: repoId, githubUserId: row.githubUserId },
      { ...row, repositoryId: repoId }
    );
  }

  async upsertIssue(repositoryId: string, row: IssueImport): Promise<UpsertOutcome> {
    const repoId = new mongoose.Types.ObjectId(repositoryId);
    return this.upsert(Issue, { githubIssueId: row.githubIssueId }, { ...row, repositoryId: repoId });
  }

  async upsertCommit(repositoryId: string, row: CommitImport): Promise<UpsertOutcome> {
    const repoId = new mongoose.Types.ObjectId(repositoryId);
    return this.upsert(
      Commit,
      { repositoryId: repoId, githubSha: row.githubSha },
      { ...row, repositoryId: repoId, pullRequestId: toObjectId(row.pullRequestId) }
    );
  }

  async upsertCheckRun(repositoryId: string, row: CheckRunImport): Promise<UpsertOutcome> {
    const repoId = new mongoose.Types.ObjectId(repositoryId);
    return this.upsert(
      CheckRun,
      { githubCheckId: row.githubCheckId },
      { ...row, repositoryId: repoId, pullRequestId: toObjectId(row.pullRequestId) }
    );
  }
}

export const normalizationService = new NormalizationService();
