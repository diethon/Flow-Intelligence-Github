import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (for MVP)
const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Rate limiter middleware
 * @param maxRequests Maximum requests allowed within the window
 * @param windowMs Time window in milliseconds
 */
export const rateLimiter = (maxRequests: number, windowMs: number) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // We use userId if authenticated, otherwise fallback to IP
    const key = (req as any).userId || req.ip || 'unknown';
    const now = Date.now();

    const record = rateLimitStore.get(key);

    if (!record) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (now > record.resetTime) {
      // Window expired, reset
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return next(
        new AppError('Too many requests, please try again later.', 429, 'TOO_MANY_REQUESTS', {
          retryAfterMs: record.resetTime - now,
        })
      );
    }

    // Increment count
    record.count += 1;
    next();
  };
};
