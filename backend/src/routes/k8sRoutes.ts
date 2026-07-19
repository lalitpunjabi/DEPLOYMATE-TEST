import { Router } from 'express';
import { getNamespaces, getPods, getDeployments, getServices, rollbackDeployment, canarySplit, blueGreenSwap } from '../controllers/k8sController';
import { authenticateToken, authorize } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/namespaces', authorize('deployments', 'read'), getNamespaces);
router.get('/:namespace/pods', authorize('deployments', 'read'), getPods);
router.get('/:namespace/deployments', authorize('deployments', 'read'), getDeployments);
router.get('/:namespace/services', authorize('deployments', 'read'), getServices);
router.post('/rollback', authorize('deployments', 'rollback'), rollbackDeployment);
router.post('/canary-split', authorize('deployments', 'rollback'), canarySplit);
router.post('/blue-green-swap', authorize('deployments', 'rollback'), blueGreenSwap);

export default router;

