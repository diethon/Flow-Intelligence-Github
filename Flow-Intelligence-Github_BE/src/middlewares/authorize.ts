import { Request, Response, NextFunction } from 'express';
import { User, UserRole } from '../models/User';
import { AppError } from '../utils/AppError';

export const authorize = (allowedRoles: UserRole[]) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, 'NOT_FOUND');
      }

      if (!allowedRoles.includes(user.role)) {
        throw new AppError('Forbidden: Insufficient permissions', 403, 'FORBIDDEN');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
