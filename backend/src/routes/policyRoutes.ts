import { Router } from 'express';
import { listPolicies, evaluatePolicy } from '../controllers/policyController';
import { authenticateToken, checkPermission } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', checkPermission('security.read'), listPolicies);
router.post('/evaluate', checkPermission('security.read'), evaluatePolicy);

export default router;
