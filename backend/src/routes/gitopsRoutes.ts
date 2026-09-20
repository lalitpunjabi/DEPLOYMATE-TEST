import { Router } from 'express';
import { getGitOpsSyncStatus, triggerGitOpsSync, forceDriftState } from '../controllers/gitopsController';
import { authenticateToken, checkPermission, requireProjectAccess } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/sync-status', checkPermission('gitops.read'), requireProjectAccess, getGitOpsSyncStatus);
router.post('/sync', checkPermission('gitops.sync'), requireProjectAccess, triggerGitOpsSync);
router.post('/drift-trigger', checkPermission('gitops.sync'), requireProjectAccess, forceDriftState);

export default router;

