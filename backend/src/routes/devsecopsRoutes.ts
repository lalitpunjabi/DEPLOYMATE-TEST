import { Router } from 'express';
import { setScanThresholds, getPipelineSecurityReport } from '../controllers/devsecopsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.post('/scan-thresholds', setScanThresholds);
router.get('/pipeline/:runId/security', getPipelineSecurityReport);

export default router;
