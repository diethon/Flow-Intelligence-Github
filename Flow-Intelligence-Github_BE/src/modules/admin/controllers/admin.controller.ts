import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import {
  User,
  Repository,
  Commit,
  PullRequest,
  SyncJob,
  GitHubConnection,
  RepositoryRole
} from '../../../models/index.js';
import { GitHubConnectionService, SyncService } from '../../github/services/index.js';
import { AppError } from '../../../utils/AppError.js';

export class AdminController {
  constructor(
    private connectionService: GitHubConnectionService,
    private syncService: SyncService
  ) {}

  // GET /api/admin/users
  async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string || '';
      const role = req.query.role as string || '';

      const query: any = {};
      if (search) {
        query.$or = [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }
      if (role) {
        query.role = role;
      }

      const total = await User.countDocuments(query);
      const users = await User.find(query)
        .select('-password -accessToken')
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        data: {
          users,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/admin/users/:id/role
  async updateUserRole(req: Request, res: Response, next: NextFunction) {
    try {
      const targetUserId = req.params.id;
      const currentUserId = (req as any).userId;
      const { role } = req.body;

      if (role !== 'admin' && role !== 'user') {
        throw new AppError('Invalid role. Allowed roles are admin or user.', 400, 'INVALID_ROLE');
      }

      if (targetUserId === currentUserId) {
        throw new AppError('You cannot change your own system role.', 400, 'SELF_ROLE_CHANGE_FORBIDDEN');
      }

      const user = await User.findByIdAndUpdate(
        targetUserId,
        { role },
        { new: true }
      ).select('-password -accessToken');

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/admin/users/:id
  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const targetUserId = req.params.id as string;
      const currentUserId = (req as any).userId;

      if (targetUserId === currentUserId) {
        throw new AppError('You cannot delete your own admin account.', 400, 'SELF_DELETE_FORBIDDEN');
      }

      const user = await User.findById(targetUserId);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      await User.findByIdAndDelete(targetUserId);
      await GitHubConnection.deleteMany({ userId: new mongoose.Types.ObjectId(targetUserId) });
      await RepositoryRole.deleteMany({ userId: new mongoose.Types.ObjectId(targetUserId) });

      res.json({ success: true, message: 'User and all associated access data deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/admin/stats
  async getSystemStats(req: Request, res: Response, next: NextFunction) {
    try {
      const totalUsers = await User.countDocuments();
      const totalRepos = await Repository.countDocuments();
      const totalCommits = await Commit.countDocuments();
      const totalPRs = await PullRequest.countDocuments();

      const syncStats = {
        pending: await SyncJob.countDocuments({ status: 'pending' }),
        running: await SyncJob.countDocuments({ status: { $in: ['running', 'processing'] } }),
        completed: await SyncJob.countDocuments({ status: 'completed' }),
        failed: await SyncJob.countDocuments({ status: 'failed' })
      };

      res.json({
        success: true,
        data: {
          totalUsers,
          totalRepos,
          totalCommits,
          totalPRs,
          syncStats
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/admin/repositories
  async getRepositories(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const total = await Repository.countDocuments();
      const repositories = await Repository.find()
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        data: {
          repositories,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/admin/repositories/:id/sync
  async forceSyncRepository(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { type, jobTypes } = req.body || {};

      await this.syncService.cleanupStuckSyncs(id);
      const result = await this.syncService.triggerSync(id, { incremental: type === 'incremental', jobTypes });

      setImmediate(async () => {
        try {
          await this.syncService.getSyncStatusById(id);
          console.log(`[Admin] Sync triggered for repository ${id}`);
        } catch (error) {
          console.error('[Admin] Error processing sync job:', error);
        }
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/admin/repositories/:id
  async disconnectRepository(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await this.connectionService.disconnectRepository(id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  // GET /api/admin/users/:id/repositories
  async getUserRepositories(req: Request, res: Response, next: NextFunction) {
    try {
      const targetUserId = req.params.id as string;

      // Find repository roles of this user and populate Repository details
      const repoRoles = await RepositoryRole.find({ userId: new mongoose.Types.ObjectId(targetUserId) })
        .populate('repositoryId')
        .lean();

      const connectedRepos = repoRoles.map((rr: any) => {
        const repo = rr.repositoryId;
        return {
          repositoryId: repo?._id || null,
          fullName: repo?.fullName || 'Unknown / Deleted Repo',
          isPrivate: repo?.isPrivate ?? false,
          lastSyncedAt: repo?.lastSyncedAt || null,
          role: rr.role,
          githubUsername: rr.githubUsername
        };
      });

      res.json({
        success: true,
        data: connectedRepos
      });
    } catch (error) {
      next(error);
    }
  }
}
