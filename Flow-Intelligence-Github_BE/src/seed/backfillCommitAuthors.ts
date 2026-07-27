/**
 * Back-fill commit author metadata for already-synced repos.
 *
 * Commits synced by an earlier code path were stored without author info
 * (authorGithubId / authorLogin empty), so per-contributor commit counts on the
 * Workload Risk page were always 0. This re-fetches recent commits from GitHub
 * using the repo's stored token and upserts them with the current (correct)
 * mapping. Idempotent — only fills in author fields, never deletes.
 *
 * Run: npx tsx src/seed/backfillCommitAuthors.ts
 */
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { GitHubRepository, RepositoryConnection } from '../modules/github/models/index.js';
import { GitHubApiService } from '../modules/github/services/githubApi.service';
import { normalizationService } from '../services/normalization.service';
import { decryptToken } from '../utils/crypto';
import type { CommitImport } from '../dto/import.dto';

const SINCE_DAYS = 120;

const run = async (): Promise<void> => {
  await connectDatabase();
  const since = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const repos = await GitHubRepository.find({ connectionId: { $ne: null } }).lean();

  for (const repo of repos) {
    const conn = await RepositoryConnection.findById(repo.connectionId).lean();
    if (!conn?.tokenEncrypted) continue;
    let token: string;
    try { token = decryptToken(conn.tokenEncrypted); } catch { console.log(`- ${repo.fullName}: token decrypt failed, skipping`); continue; }

    const api = GitHubApiService.createWithToken(token);
    let page = 1;
    let total = 0;
    let withAuthor = 0;
    try {
      while (true) {
        const commits = await api.getCommits(repo.owner, repo.name, { perPage: 100, page, since });
        if (commits.length === 0) break;
        for (const c of commits) {
          const row: CommitImport = {
            githubSha: c.sha,
            authorGithubId: c.author?.id ?? undefined,
            authorLogin: c.author?.login ?? c.commit?.author?.name ?? undefined,
            message: c.commit?.message ?? undefined,
            committedAt: new Date(c.commit?.committer?.date ?? c.commit?.author?.date ?? Date.now()),
          };
          await normalizationService.upsertCommit(repo._id.toString(), row);
          total++;
          if (row.authorGithubId != null || row.authorLogin) withAuthor++;
        }
        if (commits.length < 100) break;
        page++;
      }
      console.log(`- ${repo.fullName}: upserted ${total} commits (${withAuthor} with author)`);
    } catch (e) {
      console.log(`- ${repo.fullName}: failed —`, e instanceof Error ? e.message : e);
    }
  }
  await mongoose.disconnect();
  console.log('Back-fill complete.');
};

run().catch(async (e) => { console.error(e); await mongoose.disconnect(); process.exit(1); });
