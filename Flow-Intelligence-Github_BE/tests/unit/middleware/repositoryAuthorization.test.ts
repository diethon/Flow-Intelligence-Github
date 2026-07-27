import type { NextFunction, Response } from "express";
import {
  canViewWeeklyBrief,
  requireGlobalAdmin,
  requireRepositoryLeader,
  type AuthorizedRepositoryRequest,
} from "../../../src/middlewares/repositoryAuthorization";
import { Repository } from "../../../src/models/Repository";
import { RepositoryRole } from "../../../src/models/RepositoryRole";
import { User } from "../../../src/models/User";
import { AppError } from "../../../src/utils/AppError";

jest.mock("../../../src/models/Repository", () => ({
  Repository: { findById: jest.fn() },
}));
jest.mock("../../../src/models/RepositoryRole", () => ({
  RepositoryRole: { findOne: jest.fn() },
}));
jest.mock("../../../src/models/User", () => ({
  User: { findById: jest.fn() },
}));

const repositoryId = "64b000000000000000000001";
const userId = "64b000000000000000000002";

const query = <T>(value: T) => ({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(value),
  }),
});

const arrange = (
  globalRole: "admin" | "user" | undefined,
  repositoryRole: "leader" | "dev" | "viewer" | undefined,
  isPrivate = true
) => {
  (Repository.findById as jest.Mock).mockReturnValue(
    query({ _id: repositoryId, isPrivate })
  );
  (User.findById as jest.Mock).mockReturnValue(
    query(globalRole ? { role: globalRole } : null)
  );
  (RepositoryRole.findOne as jest.Mock).mockReturnValue(
    query(repositoryRole ? { role: repositoryRole } : null)
  );
};

const run = async (
  middleware: ReturnType<typeof jest.fn> | typeof requireRepositoryLeader,
  authenticated = true
) => {
  const req = {
    params: { id: repositoryId },
    ...(authenticated ? { userId } : {}),
  } as AuthorizedRepositoryRequest;
  const next = jest.fn() as NextFunction;
  await middleware(req, {} as Response, next);
  return { req, next };
};

const expectAllowed = (next: jest.Mock) => expect(next).toHaveBeenCalledWith();
const expectForbidden = (next: jest.Mock) => {
  const error = next.mock.calls[0]?.[0] as AppError;
  expect(error).toBeInstanceOf(AppError);
  expect(error.statusCode).toBe(403);
};

describe("requireRepositoryLeader", () => {
  it.each([
    ["Global Admin", "admin", "viewer", true],
    ["Repository Leader", "user", "leader", true],
    ["Repository Developer", "user", "dev", false],
    ["Repository Viewer", "user", "viewer", false],
  ] as const)("%s access is enforced", async (_label, globalRole, repositoryRole, allowed) => {
    arrange(globalRole, repositoryRole);
    const { next } = await run(requireRepositoryLeader);
    allowed ? expectAllowed(next as jest.Mock) : expectForbidden(next as jest.Mock);
  });
});

describe("requireGlobalAdmin", () => {
  it("allows a Global Admin", async () => {
    arrange("admin", "viewer");
    const { next } = await run(requireGlobalAdmin);
    expectAllowed(next as jest.Mock);
  });

  it.each([
    ["Repository Leader", "leader"],
    ["Repository Developer", "dev"],
    ["Repository Viewer", "viewer"],
  ] as const)("denies a non-admin %s", async (_label, repositoryRole) => {
    arrange("user", repositoryRole);
    const { next } = await run(requireGlobalAdmin);
    expectForbidden(next as jest.Mock);
  });
});

describe("canViewWeeklyBrief", () => {
  it.each([
    ["Global Admin", "admin", "viewer", true, true],
    ["Repository Leader", "user", "leader", true, true],
    ["Repository Developer", "user", "dev", true, true],
    ["Repository Viewer, private repo", "user", "viewer", true, false],
    ["Repository Viewer, public repo", "user", "viewer", false, true],
  ] as const)(
    "%s access is enforced",
    async (_label, globalRole, repositoryRole, isPrivate, allowed) => {
      arrange(globalRole, repositoryRole, isPrivate);
      const { next } = await run(canViewWeeklyBrief);
      allowed ? expectAllowed(next as jest.Mock) : expectForbidden(next as jest.Mock);
    }
  );

  it("allows an anonymous visitor only for a public repository", async () => {
    arrange(undefined, undefined, false);
    const { next } = await run(canViewWeeklyBrief, false);
    expectAllowed(next as jest.Mock);
  });

  it("denies an anonymous visitor for a private repository", async () => {
    arrange(undefined, undefined, true);
    const { next } = await run(canViewWeeklyBrief, false);
    expectForbidden(next as jest.Mock);
  });
});
