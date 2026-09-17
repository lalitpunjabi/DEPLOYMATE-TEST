import { Router } from 'express';
import { getLiveMetrics, getHistoricalMetrics } from '../controllers/monitoringController';
import { getFinOpsMetrics } from '../controllers/finopsController';
import { authenticateToken, authorize } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/live', authorize('metrics', 'read'), getLiveMetrics);
router.get('/history', authorize('metrics', 'read'), getHistoricalMetrics);
router.get('/finops', authorize('metrics', 'read'), getFinOpsMetrics);

export default router;
