import { Router } from 'express';
import { getSloHealth, getIncidents, createIncident, generatePostmortem, getSelfHealingActions } from '../controllers/sreController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/slo-health', getSloHealth);
router.get('/incidents', getIncidents);
router.post('/incidents', createIncident);
router.post('/incidents/:id/postmortem', generatePostmortem);
router.get('/self-healing-actions', getSelfHealingActions);

export default router;
