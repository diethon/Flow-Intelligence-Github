import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export const validateWebhookSignature = (req: Request, _res: Response, next: NextFunction): void => {
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new AppError('GitHub webhook secret is not configured', 500, 'WEBHOOK_SECRET_MISSING', {
      retryable: false,
    });
  }

  if (!signature) {
    throw new AppError('Missing X-Hub-Signature-256 header', 401, 'WEBHOOK_SIGNATURE_MISSING', {
      retryable: false,
    });
  }

  const body = JSON.stringify(req.body);

  const hmac = crypto.createHmac('sha256', webhookSecret);
  const digest = `sha256=${hmac.update(body).digest('hex')}`;

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
    throw new AppError('Invalid webhook signature', 401, 'WEBHOOK_SIGNATURE_INVALID', {
      retryable: false,
    });
  }

  next();
};
