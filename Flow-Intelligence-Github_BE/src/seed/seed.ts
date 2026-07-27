/**
 * Demo seed for Văn Sơn's Data Import & Evidence scope.
 *
 * Creates a demo repository, imports the sample normalized entities, then
 * generates one rule-based Evidence Card so the dashboard / Risk & Evidence
 * page has real data to render. Safe to re-run (idempotent upserts).
 *
 * Run: npm run seed
 */
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { connectDatabase } from '../config/database';
import { RepositoryConnection, GitHubRepository } from '../modules/github/models/index.js';
import { CheckRun } from '../models/checkRun.model';
import { Issue } from '../models/issue.model';
import { Commit } from '../models/commit.model';
import { Contributor } from '../models/contributor.model';
import { importService } from '../services/import.service';
import { evidenceCardService } from '../services/evidenceCard.service';
import type { ImportPayload } from '../dto/import.dto';

const DEMO_USER_ID = 'seed-demo-user';
const DEMO_GITHUB_REPO_ID = 999000001;

const loadFixture = <T>(name: string): T =>
  JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8')) as T;

const run = async (): Promise<void> => {
  await connectDatabase();

  // 1. Demo connection (token is a placeholder; never a real token in seed).
  const connection = await RepositoryConnection.findOneAndUpdate(
    { userId: DEMO_USER_ID, providerType: 'github' },
    { userId: DEMO_USER_ID, providerType: 'github', tokenEncrypted: 'seed-placeholder', status: 'active' },
    { new: true, upsert: true }
  );

  // 2. Demo repository.
  const repository = await GitHubRepository.findOneAndUpdate(
    { githubRepoId: DEMO_GITHUB_REPO_ID },
    {
      connectionId: connection._id,
      githubRepoId: DEMO_GITHUB_REPO_ID,
      owner: 'demo',
      name: 'repo',
      fullName: 'demo/repo',
      defaultBranch: 'main',
      isPrivate: false,
    },
    { new: true, upsert: true }
  );
  const repositoryId = repository._id.toString();
  console.log(`Demo repository: ${repository.fullName} (${repositoryId})`);

  // 3. Import sample normalized entities (idempotent).
  const sample = loadFixture<ImportPayload>('sample-import.json');
  const importResult = await importService.importJson(repositoryId, sample);
  console.log('Import result:', JSON.stringify(importResult.data, null, 2));

  // 4. Generate a few rule-based Evidence Cards across severities so the
  //    Risk & Evidence page has diverse data to render. Each references a real
  //    imported record so evidence resolves (cards without evidence are skipped).
  const failedCheck = await CheckRun.findOne({ repositoryId: repository._id, conclusion: 'failure' });
  const commit = await Commit.findOne({ repositoryId: repository._id });
  const issue = await Issue.findOne({ repositoryId: repository._id });

  const cardInputs = [
    failedCheck && {
      ruleCode: 'R4',
      severity: 'high' as const,
      title: 'CI friction: build is failing',
      summary: 'A required check failed on the latest commit to the default branch.',
      affectedEntityRefs: [
        { entityType: 'check_run' as const, entityId: failedCheck._id.toString() },
        ...(commit ? [{ entityType: 'commit' as const, entityId: commit._id.toString() }] : []),
      ],
    },
    issue && {
      ruleCode: 'R1',
      severity: 'medium' as const,
      title: 'Open bug issue is aging without movement',
      summary: 'A bug-labelled issue has stayed open with no update for several days.',
      affectedEntityRefs: [{ entityType: 'issue' as const, entityId: issue._id.toString() }],
    },
    commit && {
      ruleCode: 'R3',
      severity: 'low' as const,
      title: 'Recent change landed without linked review',
      summary: 'A commit reached the default branch with no associated review record.',
      affectedEntityRefs: [{ entityType: 'commit' as const, entityId: commit._id.toString() }],
    },
  ].filter(Boolean) as Parameters<typeof evidenceCardService.generateFromRiskEvent>[1][];

  let created = 0;
  for (const input of cardInputs) {
    const card = await evidenceCardService.generateFromRiskEvent(repositoryId, input);
    console.log(`Evidence Card created (${input.severity}):`, (card.data as { _id: mongoose.Types.ObjectId })._id.toString());
    created++;
  }
  console.log(`${created} Evidence Card(s) generated.`);

  // 5. Workload Risk demo: off-hours commits across several contributors so the
  //    Workload Risk page has an above-threshold, actionable signal to render.
  //    Timestamps are computed relative to "now" (UTC) so they always fall in
  //    the default 7-day window and land on weekends/nights.
  const now = new Date();
  const daysSinceSat = (now.getUTCDay() + 1) % 7; // 0 when today is Saturday
  const weekendAt = (hourUtc: number): Date => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - daysSinceSat);
    d.setUTCHours(hourUtc, 0, 0, 0);
    if (d > now) d.setUTCDate(d.getUTCDate() - 7); // keep it in the past
    return d;
  };
  const nightAt = (daysAgo: number, hourUtc: number): Date => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    d.setUTCHours(hourUtc, 0, 0, 0);
    return d;
  };

  const workloadContributors = [
    { githubUserId: 2001, login: 'demo-nightowl', displayNameMasked: 'Contributor A', type: 'User' as const },
    { githubUserId: 2002, login: 'demo-weekend', displayNameMasked: 'Contributor B', type: 'User' as const },
    { githubUserId: 2003, login: 'demo-lateshift', displayNameMasked: 'Contributor C', type: 'User' as const },
    { githubUserId: 2004, login: 'demo-alwayson', displayNameMasked: 'Contributor D', type: 'User' as const },
  ];
  for (const c of workloadContributors) {
    await Contributor.findOneAndUpdate(
      { repositoryId: repository._id, githubUserId: c.githubUserId },
      { ...c, repositoryId: repository._id },
      { upsert: true }
    );
  }

  // Mix of night (weekday) and weekend commits, plus a few in-hours ones so the
  // off-hours percentage is realistic rather than 100%.
  const workloadCommits: Array<{ gid: number; at: Date }> = [
    { gid: 2001, at: nightAt(1, 23) }, { gid: 2001, at: nightAt(3, 2) }, { gid: 2001, at: weekendAt(21) },
    { gid: 2002, at: weekendAt(15) }, { gid: 2002, at: weekendAt(18) }, { gid: 2002, at: nightAt(2, 1) },
    { gid: 2003, at: nightAt(4, 23) }, { gid: 2003, at: nightAt(1, 4) },
    { gid: 2004, at: nightAt(2, 22) }, { gid: 2004, at: weekendAt(23) },
    // in-hours (business time, weekday) — kept off-hours % below 100%
    { gid: 2001, at: nightAt(1, 10) }, { gid: 2002, at: nightAt(2, 13) }, { gid: 2004, at: nightAt(3, 11) },
  ];
  let seededCommits = 0;
  for (let i = 0; i < workloadCommits.length; i++) {
    const wc = workloadCommits[i];
    const githubSha = `workload-demo-${wc.gid}-${i}`;
    await Commit.findOneAndUpdate(
      { repositoryId: repository._id, githubSha },
      {
        repositoryId: repository._id,
        githubSha,
        authorGithubId: wc.gid,
        authorLogin: `demo-${wc.gid}`,
        message: 'demo off-hours activity',
        committedAt: wc.at,
      },
      { upsert: true }
    );
    seededCommits++;
  }
  console.log(`Seeded ${seededCommits} workload demo commits across ${workloadContributors.length} contributors.`);

  await mongoose.disconnect();
  console.log('Seed complete.');
};

run().catch(async (error) => {
  console.error('Seed failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
