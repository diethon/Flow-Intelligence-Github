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

    // Breakdown carries real GitHub identities + total vs off-hours commits.
    expect(result.breakdown).toHaveLength(3);
    expect(result.breakdown.map((b) => b.label).sort()).toEqual(["alice", "bob", "carol"]);
    const alice = result.breakdown.find((b) => b.label === "alice")!;
    expect(alice.totalCommits).toBe(2); // c1 (off-hours) + c4 (business)
    expect(alice.offHoursEvents).toBe(1);

    // Evidence points at the off-hours records only.
    expect(result.evidenceRefs).toHaveLength(3);
    expect(result.evidenceRefs.map((e) => e.entityId).sort()).toEqual(["c1", "c2", "c3"]);
    expect(result.evidenceRefs.every((e) => e.entityType === "commit")).toBe(true);
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
