import { Router } from 'express';
import { githubLogin, githubCallback, getMe, logout } from '../controllers';
import { authenticate } from '../../../middlewares/authenticate';

const router = Router();

router.get('/github', githubLogin);
router.get('/github/callback', githubCallback);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;
