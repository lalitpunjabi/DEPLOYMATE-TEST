import { Router } from 'express';
import { generateTerraformCode, planTerraform, applyTerraform, getTerraformStates } from '../controllers/terraformController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.post('/generate', generateTerraformCode);
router.post('/plan', planTerraform);
router.post('/apply', applyTerraform);
router.get('/states', getTerraformStates);

export default router;
