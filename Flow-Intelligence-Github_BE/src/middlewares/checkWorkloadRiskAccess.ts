import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { RepositoryRole } from "../models/RepositoryRole.js";
import { RepositoryConnection, GitHubRepository } from "../modules/github/models/index.js";
import { AppError } from "../utils/AppError.js";

/**
 * Middleware ensuring that only system Admins or Repository Leaders
 * can access and execute Workload Risk analysis endpoints.
 */
export const checkWorkloadRiskAccess = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, "NOT_FOUND");
    }

    // System Admins have full access across all repositories
    if (user.role === "admin") {
      return next();
    }

    // Determine target repository ID
    const repositoryId = req.params.id || req.params.repoId || req.body?.repositoryId;
    if (!repositoryId) {
      throw new AppError("Repository ID is required for workload risk authorization", 400, "BAD_REQUEST");
    }

    // Verify if user has a 'leader' role for this specific repository
    const repoRole = await RepositoryRole.findOne({
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (repoRole) {
      if (repoRole.role !== "leader") {
        throw new AppError(
          "Forbidden: Only repository leaders and system admins can view or perform operations on Workload Risk",
          403,
          "FORBIDDEN"
        );
      }
      return next();
    }

    // If no explicit RepositoryRole record exists, check if the user is the owner who connected this repo
    const repository = await GitHubRepository.findById(repositoryId);
    if (repository) {
      const connection = await RepositoryConnection.findById(repository.connectionId);
      if (connection && connection.userId.toString() === userId) {
        return next();
      }
    }

    throw new AppError(
      "Forbidden: Only repository leaders and system admins can view or perform operations on Workload Risk",
      403,
      "FORBIDDEN"
    );

    next();
  } catch (error) {
    next(error);
  }
};

export default checkWorkloadRiskAccess;
