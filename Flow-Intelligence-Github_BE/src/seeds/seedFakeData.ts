import mongoose from "mongoose";
import { Repository } from "../models/Repository.js";
import { Contributor, type IContributor } from "../models/Contributor.js";
import { PullRequest } from "../models/PullRequest.js";
import { Review } from "../models/Review.js";
import { ReviewRequest } from "../models/ReviewRequest.js";
import { CheckRun, type ICheckRun } from "../models/CheckRun.js";

type ContributorDoc = IContributor & { _id: mongoose.Types.ObjectId };

function daysAgo(d: number): Date {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000);
}
function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}
function addHours(date: Date, h: number): Date {
  return new Date(date.getTime() + h * 60 * 60 * 1000);
}

export async function seedFakeData(): Promise<{ repositoryId: string; message: string }> {
  const [r1, r2] = await Promise.all([seedRepo1(), seedRepo2()]);
  return {
    repositoryId: r1.repositoryId,
    message: `${r1.message} | ${r2.message}`,
  };
}

// ─── Repo 1: High-stress team — many bottlenecks triggered ────────────────────
async function seedRepo1(): Promise<{ repositoryId: string; message: string }> {
  // ── 1. Repository ─────────────────────────────────────────────────────────
  let repo = await Repository.findOne({ githubRepoId: 99001 });
  if (!repo) {
    repo = await Repository.create({
      githubRepoId: 99001,
      owner: "flow-team",
      name: "flow-intelligence-demo",
      fullName: "flow-team/flow-intelligence-demo",
      defaultBranch: "main",
      isPrivate: false,
      lastSyncedAt: new Date(),
    });
  }
  const repoId = repo._id as mongoose.Types.ObjectId;

  // ── 2. Contributors ───────────────────────────────────────────────────────
  const contributorData = [
    { githubUserId: 1001, login: "alice_dev", displayName: "Alice Developer" },
    { githubUserId: 1002, login: "bob_eng", displayName: "Bob Engineer" },
    { githubUserId: 1003, login: "carol_fe", displayName: "Carol Frontend" },
    { githubUserId: 1004, login: "david_be", displayName: "David Backend" },
    { githubUserId: 1005, login: "eva_lead", displayName: "Eva Lead" }, // heavy reviewer
    { githubUserId: 1006, login: "frank_qa", displayName: "Frank QA" },
  ];

  const contributors: ContributorDoc[] = [];
  for (const c of contributorData) {
    let contrib = await Contributor.findOne({ repositoryId: repoId, githubUserId: c.githubUserId });
    if (!contrib) {
      contrib = await Contributor.create({ repositoryId: repoId, ...c, avatarUrl: `https://avatars.githubusercontent.com/u/${c.githubUserId}` });
    }
    contributors.push(contrib as ContributorDoc);
  }
  const [alice, bob, carol, david, eva, frank] = contributors;

  // ── 3. Pull Requests ──────────────────────────────────────────────────────
  // Designed to produce interesting metrics:
  // - Some PRs with long review pickup time (>8h)
  // - Some with short pickup time
  // - Mix of merged/open states
  const prDefinitions = [
    // PR 1: merged, fast review (2h pickup)
    { num: 101, title: "feat: add OAuth login", author: alice, createdDaysAgo: 6, pickupH: 2, mergedDaysAgo: 5, additions: 120, deletions: 30, files: 6 },
    // PR 2: merged, slow review (18h pickup — triggers R2)
    { num: 102, title: "refactor: split auth service", author: bob, createdDaysAgo: 6, pickupH: 18, mergedDaysAgo: 4, additions: 340, deletions: 200, files: 14 },
    // PR 3: merged, moderate (5h pickup)
    { num: 103, title: "fix: null pointer on user profile", author: carol, createdDaysAgo: 5, pickupH: 5, mergedDaysAgo: 4, additions: 45, deletions: 10, files: 3 },
    // PR 4: merged, fast (1h pickup)
    { num: 104, title: "docs: update API reference", author: david, createdDaysAgo: 5, pickupH: 1, mergedDaysAgo: 4, additions: 80, deletions: 20, files: 4 },
    // PR 5: merged, slow (24h pickup — triggers R2)
    { num: 105, title: "feat: implement rate limiting", author: eva, createdDaysAgo: 7, pickupH: 24, mergedDaysAgo: 5, additions: 210, deletions: 50, files: 9 },
    // PR 6: open, no review yet
    { num: 106, title: "feat: add Redis cache layer", author: alice, createdDaysAgo: 3, pickupH: null, mergedDaysAgo: null, additions: 600, deletions: 100, files: 22 },
    // PR 7: merged, fast (3h pickup)
    { num: 107, title: "fix: broken pagination", author: frank, createdDaysAgo: 4, pickupH: 3, mergedDaysAgo: 3, additions: 55, deletions: 40, files: 5 },
    // PR 8: merged, very slow (36h pickup — stale PR)
    { num: 108, title: "chore: upgrade mongoose to v9", author: bob, createdDaysAgo: 7, pickupH: 36, mergedDaysAgo: 4, additions: 180, deletions: 170, files: 8 },
    // PR 9: open, no review (recent)
    { num: 109, title: "feat: export CSV report", author: carol, createdDaysAgo: 1, pickupH: null, mergedDaysAgo: null, additions: 130, deletions: 20, files: 7 },
    // PR 10: merged, moderate (8h pickup)
    { num: 110, title: "fix: session expiry edge case", author: david, createdDaysAgo: 4, pickupH: 8, mergedDaysAgo: 3, additions: 70, deletions: 25, files: 4 },
    // PR 11: merged, fast (1.5h pickup)
    { num: 111, title: "style: update button components", author: frank, createdDaysAgo: 3, pickupH: 1.5, mergedDaysAgo: 2, additions: 90, deletions: 80, files: 12 },
    // PR 12: merged, oversized (>500 lines — triggers R5)
    { num: 112, title: "feat: full dashboard redesign", author: alice, createdDaysAgo: 6, pickupH: 10, mergedDaysAgo: 4, additions: 800, deletions: 200, files: 30 },
    // PR 13: open, draft
    { num: 113, title: "WIP: new onboarding flow", author: eva, createdDaysAgo: 2, pickupH: null, mergedDaysAgo: null, additions: 220, deletions: 10, files: 10 },
    // PR 14: merged, moderate (6h pickup)
    { num: 114, title: "fix: webhook signature validation", author: bob, createdDaysAgo: 5, pickupH: 6, mergedDaysAgo: 3, additions: 85, deletions: 30, files: 5 },
    // PR 15: merged, very slow (48h pickup)
    { num: 115, title: "feat: AI brief generation endpoint", author: carol, createdDaysAgo: 7, pickupH: 48, mergedDaysAgo: 5, additions: 310, deletions: 80, files: 15 },
  ];

  const createdPRs: Awaited<ReturnType<typeof PullRequest.findOne>>[] = [];
  let githubPrId = 200001;
  let reviewIdCounter = 300001;
  let reviewRequestCounter = 400001;

  for (const def of prDefinitions) {
    const prCreatedAt = daysAgo(def.createdDaysAgo);
    const readyForReviewAt = def.title.startsWith("WIP") ? null : prCreatedAt;
    const mergedAt = def.mergedDaysAgo !== null ? daysAgo(def.mergedDaysAgo) : null;
    const state = mergedAt ? "merged" : "open";

    let pr = await PullRequest.findOne({ repositoryId: repoId, number: def.num });
    if (!pr) {
      pr = await PullRequest.create({
        repositoryId: repoId,
        githubPrId: githubPrId++,
        number: def.num,
        title: def.title,
        state,
        isDraft: def.title.startsWith("WIP"),
        authorId: def.author._id,
        createdAt: prCreatedAt,
        readyForReviewAt,
        mergedAt,
        closedAt: mergedAt,
        additions: def.additions,
        deletions: def.deletions,
        changedFiles: def.files,
      });
    }
    createdPRs.push(pr);

    // Create review requests and reviews for PRs that have a pickup time
    if (def.pickupH !== null && !def.title.startsWith("WIP")) {
      const requestedAt = addHours(prCreatedAt, 0.5); // Reviewer requested 30 min after PR open
      const firstReviewAt = addHours(prCreatedAt, def.pickupH);

      // Review request — primarily to Eva (heavy reviewer) or Bob
      const primaryReviewer = def.num % 3 === 0 ? bob : eva; // Eva gets majority of reviews
      const existingRequest = await ReviewRequest.findOne({ pullRequestId: pr._id });
      if (!existingRequest) {
        await ReviewRequest.create({
          repositoryId: repoId,
          pullRequestId: pr._id,
          requestedReviewerId: primaryReviewer._id,
          requestedAt,
        });
        reviewRequestCounter++;
      }

      // First review by primary reviewer (Eva or Bob)
      const existingReview = await Review.findOne({ pullRequestId: pr._id });
      if (!existingReview) {
        const firstState = def.pickupH > 20 ? "CHANGES_REQUESTED" : "APPROVED";
        await Review.create({
          repositoryId: repoId,
          pullRequestId: pr._id,
          githubReviewId: reviewIdCounter++,
          reviewerId: primaryReviewer._id,
          state: firstState,
          submittedAt: firstReviewAt,
        });

        // If changes requested, add a follow-up approval from the same reviewer
        if (firstState === "CHANGES_REQUESTED") {
          const followUpAt = addHours(firstReviewAt, 4);
          await Review.create({
            repositoryId: repoId,
            pullRequestId: pr._id,
            githubReviewId: reviewIdCounter++,
            reviewerId: primaryReviewer._id,
            state: "APPROVED",
            submittedAt: followUpAt,
          });
        }

        // For complex PRs, add a second reviewer comment
        if (def.additions > 200) {
          const secondReviewer = primaryReviewer._id.equals(eva._id) ? carol : frank;
          await Review.create({
            repositoryId: repoId,
            pullRequestId: pr._id,
            githubReviewId: reviewIdCounter++,
            reviewerId: secondReviewer._id,
            state: "COMMENTED",
            submittedAt: addHours(firstReviewAt, 1),
          });
        }
      }
    }
  }

  // ── 4. Check Runs ─────────────────────────────────────────────────────────
  // CI checks across the last 7 days — ~35% failure rate to trigger R4
  const checkNames = ["unit-tests", "integration-tests", "lint", "build", "e2e-tests"];
  const checkConclusions: Array<ICheckRun["conclusion"]> = [
    "success", "success", "success", "success", "success",
    "success", "success", "failure", "failure", "timed_out",
  ];

  let githubCheckId = 500001;

  for (const pr of createdPRs.slice(0, 12)) {
    if (!pr) continue;
    for (const checkName of checkNames) {
      const exists = await CheckRun.findOne({ repositoryId: repoId, pullRequestId: pr._id, name: checkName });
      if (!exists) {
        const completedAt = hoursAgo(Math.random() * 7 * 24);
        const conclusion = checkConclusions[Math.floor(Math.random() * checkConclusions.length)];
        await CheckRun.create({
          repositoryId: repoId,
          pullRequestId: pr._id,
          githubCheckId: githubCheckId++,
          name: checkName,
          status: "completed",
          conclusion,
          startedAt: new Date(completedAt.getTime() - (2 + Math.random() * 8) * 60 * 1000),
          completedAt,
        });
      }
    }
  }

  return {
    repositoryId: repoId.toString(),
    message: `Seeded: ${repo.fullName}`,
  };
}

// ─── Repo 2: Healthy small team — minimal bottlenecks ─────────────────────────
async function seedRepo2(): Promise<{ repositoryId: string; message: string }> {
  let repo = await Repository.findOne({ githubRepoId: 99002 });
  if (!repo) {
    repo = await Repository.create({
      githubRepoId: 99002,
      owner: "platform-squad",
      name: "api-gateway-service",
      fullName: "platform-squad/api-gateway-service",
      defaultBranch: "main",
      isPrivate: true,
      lastSyncedAt: new Date(),
    });
  }
  const repoId = repo._id as mongoose.Types.ObjectId;

  // Contributors — 4-person well-balanced team
  const contributorData = [
    { githubUserId: 2001, login: "kira_eng",   displayName: "Kira Engineer"   },
    { githubUserId: 2002, login: "liam_dev",   displayName: "Liam Developer"  },
    { githubUserId: 2003, login: "mia_ops",    displayName: "Mia DevOps"      },
    { githubUserId: 2004, login: "noah_arch",  displayName: "Noah Architect"  },
  ];
  const contributors: ContributorDoc[] = [];
  for (const c of contributorData) {
    let contrib = await Contributor.findOne({ repositoryId: repoId, githubUserId: c.githubUserId });
    if (!contrib) {
      contrib = await Contributor.create({
        repositoryId: repoId, ...c,
        avatarUrl: `https://avatars.githubusercontent.com/u/${c.githubUserId}`,
      });
    }
    contributors.push(contrib as ContributorDoc);
  }
  const [kira, liam, mia, noah] = contributors;

  // PRs — healthy patterns: fast pickup, balanced load, small sizes
  const prDefs = [
    { num: 201, title: "feat: rate limit middleware",     author: kira, createdDaysAgo: 6,  pickupH: 1.5, mergedDaysAgo: 5,  additions: 80,  deletions: 20,  files: 5  },
    { num: 202, title: "fix: header injection",           author: liam, createdDaysAgo: 6,  pickupH: 2,   mergedDaysAgo: 5,  additions: 35,  deletions: 10,  files: 3  },
    { num: 203, title: "chore: bump dependencies",        author: mia,  createdDaysAgo: 5,  pickupH: 3,   mergedDaysAgo: 4,  additions: 60,  deletions: 55,  files: 6  },
    { num: 204, title: "feat: add circuit breaker",       author: noah, createdDaysAgo: 5,  pickupH: 2.5, mergedDaysAgo: 4,  additions: 150, deletions: 40,  files: 8  },
    { num: 205, title: "fix: JWT expiry edge case",       author: kira, createdDaysAgo: 4,  pickupH: 1,   mergedDaysAgo: 3,  additions: 25,  deletions: 8,   files: 2  },
    { num: 206, title: "feat: request tracing headers",   author: liam, createdDaysAgo: 4,  pickupH: 4,   mergedDaysAgo: 3,  additions: 110, deletions: 30,  files: 7  },
    { num: 207, title: "refactor: extract auth handler",  author: mia,  createdDaysAgo: 3,  pickupH: 2,   mergedDaysAgo: 2,  additions: 95,  deletions: 85,  files: 6  },
    { num: 208, title: "docs: OpenAPI spec update",       author: noah, createdDaysAgo: 3,  pickupH: 1.5, mergedDaysAgo: 2,  additions: 200, deletions: 180, files: 4  },
    { num: 209, title: "fix: timeout retry logic",        author: kira, createdDaysAgo: 2,  pickupH: 3,   mergedDaysAgo: 1,  additions: 45,  deletions: 20,  files: 3  },
    { num: 210, title: "feat: health check endpoint",     author: liam, createdDaysAgo: 1,  pickupH: null, mergedDaysAgo: null, additions: 55, deletions: 5, files: 4 },
    // Slightly slow one to be realistic
    { num: 211, title: "feat: multi-region routing",      author: mia,  createdDaysAgo: 7,  pickupH: 9,   mergedDaysAgo: 5,  additions: 230, deletions: 60,  files: 12 },
    { num: 212, title: "test: add integration tests",     author: noah, createdDaysAgo: 5,  pickupH: 2,   mergedDaysAgo: 3,  additions: 180, deletions: 10,  files: 9  },
  ];

  // Balanced review assignments: rotate between all 4
  const reviewers = [kira, liam, mia, noah];
  let reviewIdCounter = 700001;

  for (const def of prDefs) {
    const prCreatedAt = daysAgo(def.createdDaysAgo);
    const mergedAt = def.mergedDaysAgo !== null ? daysAgo(def.mergedDaysAgo) : null;
    const state = mergedAt ? "merged" : "open";

    let pr = await PullRequest.findOne({ repositoryId: repoId, number: def.num });
    if (!pr) {
      pr = await PullRequest.create({
        repositoryId: repoId,
        githubPrId: 600000 + def.num,
        number: def.num,
        title: def.title,
        state,
        isDraft: false,
        authorId: def.author._id,
        createdAt: prCreatedAt,
        readyForReviewAt: prCreatedAt,
        mergedAt,
        closedAt: mergedAt,
        additions: def.additions,
        deletions: def.deletions,
        changedFiles: def.files,
      });
    }

    if (def.pickupH !== null) {
      const reviewerIdx = (def.num - 201) % 4;
      // Reviewer is not the author
      let assignedReviewer = reviewers[reviewerIdx];
      if (assignedReviewer._id.equals(def.author._id)) {
        assignedReviewer = reviewers[(reviewerIdx + 1) % 4];
      }

      const existingReview = await Review.findOne({ pullRequestId: pr._id });
      if (!existingReview) {
        await ReviewRequest.create({
          repositoryId: repoId,
          pullRequestId: pr._id,
          requestedReviewerId: assignedReviewer._id,
          requestedAt: addHours(prCreatedAt, 0.25),
        });
        await Review.create({
          repositoryId: repoId,
          pullRequestId: pr._id,
          githubReviewId: reviewIdCounter++,
          reviewerId: assignedReviewer._id,
          state: "APPROVED",
          submittedAt: addHours(prCreatedAt, def.pickupH),
        });
      }
    }
  }

  // Check runs — healthy: ~8% failure rate (well below R4 threshold)
  const checkNames = ["unit-tests", "lint", "build", "integration-tests"];
  const goodConclusions: Array<ICheckRun["conclusion"]> = [
    "success", "success", "success", "success",
    "success", "success", "success", "success",
    "success", "failure", "success", "success",
  ];

  const allPRs = await PullRequest.find({ repositoryId: repoId });
  let githubCheckId = 800001;

  for (const pr of allPRs) {
    for (const checkName of checkNames) {
      const exists = await CheckRun.findOne({ repositoryId: repoId, pullRequestId: pr._id, name: checkName });
      if (!exists) {
        const completedAt = hoursAgo(Math.random() * 7 * 24);
        const conclusion = goodConclusions[Math.floor(Math.random() * goodConclusions.length)];
        await CheckRun.create({
          repositoryId: repoId,
          pullRequestId: pr._id,
          githubCheckId: githubCheckId++,
          name: checkName,
          status: "completed",
          conclusion,
          startedAt: new Date(completedAt.getTime() - (1 + Math.random() * 4) * 60 * 1000),
          completedAt,
        });
      }
    }
  }

  return {
    repositoryId: repoId.toString(),
    message: `Seeded: ${repo.fullName}`,
  };
}

