import { Router } from 'express';
import { generateTerraformCode, planTerraform, applyTerraform, getTerraformStates } from '../controllers/terraformController';
import { authenticateToken, checkPermission, requireProjectAccess } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/states', checkPermission('terraform.read'), requireProjectAccess, getTerraformStates);
router.post('/generate', checkPermission('terraform.plan'), requireProjectAccess, generateTerraformCode);
router.post('/plan', checkPermission('terraform.plan'), requireProjectAccess, planTerraform);
router.post('/apply', checkPermission('terraform.apply'), requireProjectAccess, applyTerraform);

export default router;

