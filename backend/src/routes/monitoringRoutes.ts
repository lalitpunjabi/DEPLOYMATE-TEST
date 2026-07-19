import { Router } from 'express';
import { getLiveMetrics, getHistoricalMetrics } from '../controllers/monitoringController';
import { authenticateToken, authorize } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/live', authorize('metrics', 'read'), getLiveMetrics);
router.get('/history', authorize('metrics', 'read'), getHistoricalMetrics);

export default router;
