import { Router } from 'express';
import { injectChaos, getChaosHistory } from '../controllers/chaosController';
import { authenticateToken, checkPermission } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/history', checkPermission('chaos.read'), getChaosHistory);
router.post('/inject', checkPermission('chaos.execute'), injectChaos);

export default router;
