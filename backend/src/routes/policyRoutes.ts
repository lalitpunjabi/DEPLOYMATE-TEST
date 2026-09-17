import { Router } from 'express';
import { listPolicies, evaluatePolicy } from '../controllers/policyController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', listPolicies);
router.post('/evaluate', evaluatePolicy);

export default router;
