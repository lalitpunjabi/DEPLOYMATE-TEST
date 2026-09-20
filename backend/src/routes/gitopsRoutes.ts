import { Router } from 'express';
import { getGitOpsSyncStatus, triggerGitOpsSync, forceDriftState } from '../controllers/gitopsController';
import { authenticateToken, checkPermission } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/sync-status', checkPermission('gitops.read'), getGitOpsSyncStatus);
router.post('/sync', checkPermission('gitops.sync'), triggerGitOpsSync);
router.post('/drift-trigger', checkPermission('gitops.sync'), forceDriftState);

export default router;
