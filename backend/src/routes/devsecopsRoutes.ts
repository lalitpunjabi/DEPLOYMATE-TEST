import { Router } from 'express';
import { setScanThresholds, getPipelineSecurityReport } from '../controllers/devsecopsController';
import { authenticateToken, checkPermission, requireProjectAccess } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/pipeline/:runId/security', checkPermission('security.read'), requireProjectAccess, getPipelineSecurityReport);
router.post('/scan-thresholds', checkPermission('security.override'), requireProjectAccess, setScanThresholds);

export default router;

