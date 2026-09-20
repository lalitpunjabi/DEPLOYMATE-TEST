import { Router } from 'express';
import { getNamespaces, getPods, getDeployments, getServices, rollbackDeployment, canarySplit, blueGreenSwap } from '../controllers/k8sController';
import { authenticateToken, authorize, requireProjectAccess } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/namespaces', authorize('deployments', 'read'), getNamespaces);
router.get('/:namespace/pods', authorize('deployments', 'read'), requireProjectAccess, getPods);
router.get('/:namespace/deployments', authorize('deployments', 'read'), requireProjectAccess, getDeployments);
router.get('/:namespace/services', authorize('deployments', 'read'), requireProjectAccess, getServices);
router.post('/rollback', authorize('deployments', 'rollback'), requireProjectAccess, rollbackDeployment);
router.post('/canary-split', authorize('deployments', 'rollback'), requireProjectAccess, canarySplit);
router.post('/blue-green-swap', authorize('deployments', 'rollback'), requireProjectAccess, blueGreenSwap);

export default router;


