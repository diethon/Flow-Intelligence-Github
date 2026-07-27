import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { User, UserRole } from '../models/User.js';
import { RepositoryRole } from '../models/RepositoryRole.js';
import { Repository } from '../models/Repository.js';
import { AppError } from '../utils/AppError.js';

export const repoAuthorize = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const repoId = req.params["repoId"] || req.body["repositoryId"];
      if (!repoId || !mongoose.Types.ObjectId.isValid(repoId)) {
        throw new AppError('Invalid repository ID', 400, 'BAD_REQUEST');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'NOT_FOUND');
      }

      // Global admin can do anything
      if (user.role === 'admin') {
        (req as any).userRepoRole = 'admin';
        return next();
      }

      const repo = await Repository.findById(repoId);
      if (!repo) {
        throw new AppError('Repository not found', 404, 'NOT_FOUND');
      }

      let currentRole = 'none';

      // Check specific repository role
      const repoRoleDoc = await RepositoryRole.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        repositoryId: new mongoose.Types.ObjectId(repoId)
      });

      if (repoRoleDoc) {
        currentRole = repoRoleDoc.role;
      } else {
        // If not explicitly a member, but repo is public, they act as a viewer
        if (!repo.isPrivate) {
          currentRole = 'viewer';
        }
      }

      if (currentRole === 'none' || !allowedRoles.includes(currentRole)) {
        throw new AppError('Forbidden: Insufficient permissions for this repository', 403, 'FORBIDDEN');
      }

      // Store resolved role in request for potential downstream use (e.g., chat intent)
      (req as any).userRepoRole = currentRole;

      next();
    } catch (error) {
      next(error);
    }
  };
};
