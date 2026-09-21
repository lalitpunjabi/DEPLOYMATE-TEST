import { Router } from 'express';
import { getSloHealth, getIncidents, createIncident, generatePostmortem, getSelfHealingActions } from '../controllers/sreController';
import { authenticateToken, checkPermission, requireProjectAccess } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/slo-health', checkPermission('incident.read'), requireProjectAccess, getSloHealth);
router.get('/incidents', checkPermission('incident.read'), requireProjectAccess, getIncidents);
router.post('/incidents', checkPermission('incident.create'), requireProjectAccess, createIncident);
router.post('/incidents/:id/postmortem', checkPermission('incident.resolve'), requireProjectAccess, generatePostmortem);
router.get('/self-healing-actions', checkPermission('incident.read'), requireProjectAccess, getSelfHealingActions);

export default router;

