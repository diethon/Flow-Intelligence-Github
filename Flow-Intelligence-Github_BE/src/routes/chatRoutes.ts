import { Router } from 'express';
import { chatWithData } from '../controllers/chatController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { repoAuthorize } from '../middlewares/repoAuthorize.js';
import { rateLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

// Endpoint for Chat With Your Data
// Requires authentication, user or admin role, and max 20 requests per minute
router.post(
  '/',
  authenticate,
  authorize(['user', 'admin']),
  repoAuthorize(['leader', 'dev', 'viewer']),
  rateLimiter(20, 60 * 1000), // 20 requests per minute (60,000 ms)
  chatWithData
);

export default router;
