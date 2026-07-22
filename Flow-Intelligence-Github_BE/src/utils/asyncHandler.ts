import { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError';

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      if (!(error instanceof AppError)) {
        const appError = new AppError(
          error?.message || 'Internal server error',
          500,
          'INTERNAL_SERVER_ERROR',
          {
            originalError: error?.name,
            stack: error?.stack,
          },
          true
        );
        next(appError);
        return;
      }
      next(error);
    });
  };
