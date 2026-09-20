import { Router } from 'express';
import { injectChaos, getChaosHistory } from '../controllers/chaosController';
import { authenticateToken, checkPermission, requireProjectAccess } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/history', checkPermission('chaos.read'), requireProjectAccess, getChaosHistory);
router.post('/inject', checkPermission('chaos.execute'), requireProjectAccess, injectChaos);

export default router;

