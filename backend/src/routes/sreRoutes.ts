import { Router } from 'express';
import { getSloHealth, getIncidents, createIncident, generatePostmortem, getSelfHealingActions } from '../controllers/sreController';
import { authenticateToken, checkPermission } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/slo-health', checkPermission('incident.read'), getSloHealth);
router.get('/incidents', checkPermission('incident.read'), getIncidents);
router.post('/incidents', checkPermission('incident.create'), createIncident);
router.post('/incidents/:id/postmortem', checkPermission('incident.resolve'), generatePostmortem);
router.get('/self-healing-actions', checkPermission('incident.read'), getSelfHealingActions);

export default router;
