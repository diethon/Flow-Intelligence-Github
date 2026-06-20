import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from '../config/env';
import { AppError } from '../utils/AppError';

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED', {
      message: 'Missing or invalid authorization header',
      retryable: false,
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED', {
      message: 'Bearer token is missing',
      retryable: false,
    });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    (req as Request & { userId?: string }).userId = decoded.userId;
    next();
  } catch {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED', {
      message: 'Invalid or expired token',
      retryable: false,
    });
  }
};

export const optionalAuthenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
        (req as Request & { userId?: string }).userId = decoded.userId;
      } catch {
        // Token invalid, continue without userId
      }
    }
  }

  next();
};
