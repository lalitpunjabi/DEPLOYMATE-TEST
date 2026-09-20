import { Router } from 'express';
import { generateTerraformCode, planTerraform, applyTerraform, getTerraformStates } from '../controllers/terraformController';
import { authenticateToken, checkPermission } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/states', checkPermission('terraform.read'), getTerraformStates);
router.post('/generate', checkPermission('terraform.plan'), generateTerraformCode);
router.post('/plan', checkPermission('terraform.plan'), planTerraform);
router.post('/apply', checkPermission('terraform.apply'), applyTerraform);

export default router;
