import { Router } from 'express';
import { listUsers, updateUserRole, toggleUserStatus, listActiveSessions, revokeSession } from '../controllers/adminController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Protect all admin endpoints strictly with JWT authentication and Super Admin role requirement
router.use(authenticateToken);
router.use(requireRole('Super Admin'));

router.get('/users', listUsers);
router.patch('/users/:userId/role', updateUserRole);
router.patch('/users/:userId/status', toggleUserStatus);
router.get('/sessions', listActiveSessions);
router.post('/sessions/revoke', revokeSession);
router.post('/sessions/:sessionId/revoke', revokeSession);

export default router;
