import { Router } from 'express';
import { setScanThresholds, getPipelineSecurityReport } from '../controllers/devsecopsController';
import { authenticateToken, checkPermission } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/pipeline/:runId/security', checkPermission('security.read'), getPipelineSecurityReport);
router.post('/scan-thresholds', checkPermission('security.override'), setScanThresholds);

export default router;
