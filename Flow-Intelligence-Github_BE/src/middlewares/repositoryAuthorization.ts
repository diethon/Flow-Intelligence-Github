import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { Repository } from "../models/Repository";
import { RepositoryRole } from "../models/RepositoryRole";
import { User } from "../models/User";
import { AppError } from "../utils/AppError";

export type ResolvedRepositoryRole = "leader" | "dev" | "viewer";

export interface RepositoryAuthorization {
  repository: {
    _id: mongoose.Types.ObjectId;
    isPrivate: boolean;
  };
  isGlobalAdmin: boolean;
  repositoryRole: ResolvedRepositoryRole;
  canManage: boolean;
}

export type AuthorizedRepositoryRequest = Request & {
  userId?: string;
  repositoryAuthorization?: RepositoryAuthorization;
};

const forbidden = () =>
  new AppError("You do not have permission to perform this action", 403, "FORBIDDEN");

export const requireGlobalAdmin = async (
  req: AuthorizedRepositoryRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.userId || !mongoose.Types.ObjectId.isValid(req.userId)) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }
    const user = await User.findById(req.userId).select("role").lean();
    if (!user) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }
    if (user.role !== "admin") {
      throw forbidden();
    }
    next();
  } catch (error) {
    next(error);
  }
};

async function resolveAuthorization(req: AuthorizedRepositoryRequest): Promise<RepositoryAuthorization> {
  const repositoryId = String(req.params.id ?? "");
  if (!mongoose.Types.ObjectId.isValid(repositoryId)) {
    throw new AppError("Repository not found", 404, "REPOSITORY_NOT_FOUND");
  }

  const repository = await Repository.findById(repositoryId).select("_id isPrivate").lean();
  if (!repository) {
    throw new AppError("Repository not found", 404, "REPOSITORY_NOT_FOUND");
  }

  let isGlobalAdmin = false;
  let repositoryRole: ResolvedRepositoryRole = "viewer";

  if (req.userId) {
    if (!mongoose.Types.ObjectId.isValid(req.userId)) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const [user, membership] = await Promise.all([
      User.findById(req.userId).select("role").lean(),
      RepositoryRole.findOne({
        repositoryId: repository._id,
        userId: new mongoose.Types.ObjectId(req.userId),
      })
        .select("role")
        .lean(),
    ]);

    if (!user) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }

    isGlobalAdmin = user.role === "admin";
    if (membership) {
      repositoryRole = membership.role;
    }
  }

  return {
    repository: {
      _id: repository._id,
      isPrivate: repository.isPrivate,
    },
    isGlobalAdmin,
    repositoryRole,
    canManage: isGlobalAdmin || repositoryRole === "leader",
  };
}

const authorize =
  (check: (authorization: RepositoryAuthorization, request: AuthorizedRepositoryRequest) => boolean) =>
  async (req: AuthorizedRepositoryRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authorization = await resolveAuthorization(req);
      if (!check(authorization, req)) {
        throw forbidden();
      }
      req.repositoryAuthorization = authorization;
      next();
    } catch (error) {
      next(error);
    }
  };

/** Global Admins and GitHub repository admins (Repository Leaders). */
export const requireRepositoryLeader = authorize(({ canManage }) => canManage);

/**
 * Drafts are returned only to managers by the controller. Developers may read
 * published briefs; viewers and anonymous visitors may do so only for public repos.
 */
export const canViewWeeklyBrief = authorize(
  ({ isGlobalAdmin, repositoryRole, repository }) =>
    isGlobalAdmin ||
    repositoryRole === "leader" ||
    repositoryRole === "dev" ||
    !repository.isPrivate
);
