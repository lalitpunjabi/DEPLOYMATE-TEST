import { Router } from 'express';
import { listProjects, createProject, deleteProject, getAuditLogs } from '../controllers/projectController';
import { authenticateToken, authorize } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/audit-logs', getAuditLogs);
router.get('/', authorize('projects', 'read'), listProjects);
router.post('/', authorize('projects', 'create'), createProject);
router.delete('/:id', authorize('projects', 'delete'), deleteProject);

export default router;
