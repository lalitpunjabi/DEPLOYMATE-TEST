import { Router } from 'express';
import { getCentralizedLogs } from '../controllers/logsController';
import { authenticateToken, authorize } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/', authorize('logs', 'read'), getCentralizedLogs);

export default router;
