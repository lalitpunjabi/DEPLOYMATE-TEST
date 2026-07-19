import { Router } from 'express';
import { getGitOpsSyncStatus, triggerGitOpsSync, forceDriftState } from '../controllers/gitopsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/sync-status', getGitOpsSyncStatus);
router.post('/sync', triggerGitOpsSync);
router.post('/drift-trigger', forceDriftState);

export default router;
