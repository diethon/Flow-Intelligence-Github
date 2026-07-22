import { jest } from "@jest/globals";

// Mock the models queried by calculateWorkloadRisk before importing it.
jest.mock("../../src/models/Commit", () => ({ Commit: { find: jest.fn() } }));
jest.mock("../../src/models/Review", () => ({ Review: { find: jest.fn() } }));
jest.mock("../../src/models/Contributor", () => ({ Contributor: { find: jest.fn() } }));

import { calculateWorkloadRisk } from "../../src/services/metricsEngine";
import { Commit } from "../../src/models/Commit";
import { Review } from "../../src/models/Review";
import { Contributor } from "../../src/models/Contributor";

const REPO_ID = "64b7f0c2e1a2b3c4d5e6f7a8";

/** Build the find().select().lean() chain returning `data`. */
function chain(data: unknown[]) {
  return { select: () => ({ lean: () => Promise.resolve(data) }) };
}

function oid(id: string) {
  return { toString: () => id };
}

const commitFind = Commit.find as jest.Mock;
const reviewFind = Review.find as jest.Mock;
const contributorFind = Contributor.find as jest.Mock;

/** Contributor docs mapping githubUserId -> _id + login, as the engine resolves. */
const CONTRIBUTORS = [
  { _id: oid("u1"), githubUserId: 1, login: "alice" },
  { _id: oid("u2"), githubUserId: 2, login: "bob" },
  { _id: oid("u3"), githubUserId: 3, login: "carol" },
];

describe("calculateWorkloadRisk", () => {
  const windowStart = new Date("2026-07-13T00:00:00Z");
  const windowEnd = new Date("2026-07-20T00:00:00Z");

  beforeEach(() => {
    contributorFind.mockReturnValue(chain(CONTRIBUTORS));
  });

  it("returns insufficient_data below the group threshold (privacy guard)", async () => {
    commitFind.mockReturnValue(
      chain([
        { _id: oid("c1"), committedAt: new Date("2026-07-17T23:00:00Z"), authorGithubId: 1 }, // night
        { _id: oid("c2"), committedAt: new Date("2026-07-17T22:00:00Z"), authorGithubId: 2 }, // night
        { _id: oid("c3"), committedAt: new Date("2026-07-17T12:00:00Z"), authorGithubId: 1 }, // business
      ])
    );
    reviewFind.mockReturnValue(chain([]));

    const result = await calculateWorkloadRisk(REPO_ID, windowStart, windowEnd);

    expect(result.aggregate.dataStatus).toBe("insufficient_data");
    expect(result.aggregate.distinctContributorsOffHours).toBe(2);
    expect(result.breakdown).toEqual([]);
    expect(result.evidenceRefs).toEqual([]);
    expect(result.severity).toBe("low");
  });

  it("aggregates off-hours activity with pseudonymized breakdown when threshold met", async () => {
    commitFind.mockReturnValue(
      chain([
        { _id: oid("c1"), committedAt: new Date("2026-07-17T23:00:00Z"), authorGithubId: 1 }, // night
        { _id: oid("c2"), committedAt: new Date("2026-07-17T22:00:00Z"), authorGithubId: 2 }, // night
        { _id: oid("c3"), committedAt: new Date("2026-07-18T12:00:00Z"), authorGithubId: 3 }, // weekend
        { _id: oid("c4"), committedAt: new Date("2026-07-17T12:00:00Z"), authorGithubId: 1 }, // business
        { _id: oid("c5"), committedAt: new Date("2026-07-17T13:00:00Z"), authorGithubId: 2 }, // business
      ])
    );
    reviewFind.mockReturnValue(chain([]));

    const result = await calculateWorkloadRisk(REPO_ID, windowStart, windowEnd);

    expect(result.aggregate.dataStatus).toBe("ok");
    expect(result.aggregate.totalEvents).toBe(5);
    expect(result.aggregate.offHoursEvents).toBe(3);
    expect(result.aggregate.offHoursPct).toBe(60);
    expect(result.aggregate.nightCount).toBe(2);
    expect(result.aggregate.weekendCount).toBe(1);
    expect(result.aggregate.distinctContributorsOffHours).toBe(3);
    expect(result.severity).toBe("high");

    // Breakdown carries real GitHub identities + total vs off-hours activity.
    expect(result.breakdown).toHaveLength(3);
    expect(result.breakdown.map((b) => b.label).sort()).toEqual(["alice", "bob", "carol"]);
    const alice = result.breakdown.find((b) => b.label === "alice")!;
    expect(alice.totalEvents).toBe(2); // c1 (off-hours) + c4 (business)
    expect(alice.offHoursEvents).toBe(1);

    // Evidence points at the off-hours records only.
    expect(result.evidenceRefs).toHaveLength(3);
    expect(result.evidenceRefs.map((e) => e.entityId).sort()).toEqual(["c1", "c2", "c3"]);
    expect(result.evidenceRefs.every((e) => e.entityType === "commit")).toBe(true);
  });

  it("counts reviews toward a contributor's total so off-hours always has a denominator", async () => {
    // carol only reviews (no commits) — she used to show total 0 with off-hours > 0.
    commitFind.mockReturnValue(
      chain([
        { _id: oid("c1"), committedAt: new Date("2026-07-17T23:00:00Z"), authorGithubId: 1 }, // alice night
        { _id: oid("c2"), committedAt: new Date("2026-07-17T22:00:00Z"), authorGithubId: 2 }, // bob night
      ])
    );
    reviewFind.mockReturnValue(
      chain([
        { _id: oid("r1"), submittedAt: new Date("2026-07-17T23:30:00Z"), reviewerId: oid("u3") }, // carol night
        { _id: oid("r2"), submittedAt: new Date("2026-07-17T12:00:00Z"), reviewerId: oid("u3") }, // carol business
      ])
    );

    const result = await calculateWorkloadRisk(REPO_ID, windowStart, windowEnd);

    const carol = result.breakdown.find((b) => b.label === "carol")!;
    expect(carol.totalEvents).toBe(2); // r1 (off-hours) + r2 (business)
    expect(carol.offHoursEvents).toBe(1);
    expect(carol.offHoursEvents).toBeLessThanOrEqual(carol.totalEvents);

    // Commit vs review split is surfaced separately for a clearer UI.
    expect(carol.commits).toBe(0);
    expect(carol.reviews).toBe(2);
    expect(carol.offHoursCommits).toBe(0);
    expect(carol.offHoursReviews).toBe(1);
    expect(result.aggregate.commitCount).toBe(2);
    expect(result.aggregate.reviewCount).toBe(2);
    expect(result.aggregate.offHoursReviewCount).toBe(1);
    expect(result.aggregate.offHoursCommitCount).toBe(2); // alice + bob night commits
  });

  it("excludes bot / automation identities from the signal", async () => {
    // A bot committing every night must not appear or inflate the counts.
    commitFind.mockReturnValue(
      chain([
        { _id: oid("c1"), committedAt: new Date("2026-07-17T23:00:00Z"), authorGithubId: 1 }, // alice night
        { _id: oid("c2"), committedAt: new Date("2026-07-17T22:00:00Z"), authorGithubId: 2 }, // bob night
        { _id: oid("c3"), committedAt: new Date("2026-07-18T12:00:00Z"), authorGithubId: 3 }, // carol weekend
        // bot commits — no Contributor link, login flags them as automation.
        { _id: oid("b1"), committedAt: new Date("2026-07-17T23:30:00Z"), authorGithubId: 99, authorLogin: "actions-user" },
        { _id: oid("b2"), committedAt: new Date("2026-07-17T23:45:00Z"), authorLogin: "dependabot[bot]" },
      ])
    );
    reviewFind.mockReturnValue(chain([]));

    const result = await calculateWorkloadRisk(REPO_ID, windowStart, windowEnd);

    expect(result.aggregate.totalEvents).toBe(3); // bots dropped
    expect(result.aggregate.distinctContributorsOffHours).toBe(3);
    expect(result.breakdown.map((b) => b.label).sort()).toEqual(["alice", "bob", "carol"]);
    expect(result.breakdown.some((b) => /actions-user|bot/i.test(b.label))).toBe(false);
  });

  it("re-attributes a bot commit to its Co-authored-by human", async () => {
    commitFind.mockReturnValue(
      chain([
        { _id: oid("c1"), committedAt: new Date("2026-07-17T23:00:00Z"), authorGithubId: 1 }, // alice night
        { _id: oid("c2"), committedAt: new Date("2026-07-17T22:00:00Z"), authorGithubId: 2 }, // bob night
        // bot cherry-pick that carries the real author in a Co-authored-by trailer.
        {
          _id: oid("b1"),
          committedAt: new Date("2026-07-18T23:00:00Z"), // weekend night
          authorLogin: "actions-user",
          message: "[cherry-pick] Fix thing\n\nCo-authored-by: Real Dev <real@dev.io>",
        },
        // pure automation, no co-author → excluded.
        { _id: oid("b2"), committedAt: new Date("2026-07-17T23:30:00Z"), authorLogin: "dependabot[bot]", message: "bump dep" },
      ])
    );
    reviewFind.mockReturnValue(chain([]));

    const result = await calculateWorkloadRisk(REPO_ID, windowStart, windowEnd);

    expect(result.aggregate.totalEvents).toBe(3); // alice, bob, Real Dev (dependabot dropped)
    const realDev = result.breakdown.find((b) => b.label === "Real Dev");
    expect(realDev).toBeDefined();
    expect(realDev!.offHoursEvents).toBe(1);
    expect(result.breakdown.some((b) => /actions-user|dependabot/i.test(b.label))).toBe(false);
  });

  it("includes reviews and returns insufficient_data with no events", async () => {
    commitFind.mockReturnValue(chain([]));
    reviewFind.mockReturnValue(chain([]));

    const result = await calculateWorkloadRisk(REPO_ID, windowStart, windowEnd);

    expect(result.aggregate.totalEvents).toBe(0);
    expect(result.aggregate.offHoursPct).toBeNull();
    expect(result.aggregate.dataStatus).toBe("insufficient_data");
  });
});
