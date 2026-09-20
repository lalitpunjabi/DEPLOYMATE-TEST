import { Router } from 'express';
import { listProjects, createProject, deleteProject, getAuditLogs } from '../controllers/projectController';
import { authenticateToken, authorize, checkPermission, requireProjectAccess } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/audit-logs', checkPermission('security.read'), getAuditLogs);
router.get('/', authorize('projects', 'read'), listProjects);
router.post('/', authorize('projects', 'create'), createProject);
router.delete('/:id', authorize('projects', 'delete'), requireProjectAccess, deleteProject);

export default router;
