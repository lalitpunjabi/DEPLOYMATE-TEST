import { Router } from 'express';
import { injectChaos, getChaosHistory } from '../controllers/chaosController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.post('/inject', injectChaos);
router.get('/history', getChaosHistory);

export default router;
