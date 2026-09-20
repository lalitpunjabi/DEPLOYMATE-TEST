import { Router } from 'express';
import { listPipelines, createPipeline, runPipeline, listPipelineRuns, getPipelineRun } from '../controllers/pipelineController';
import { authenticateToken, authorize, requireProjectAccess } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/', authorize('pipelines', 'read'), requireProjectAccess, listPipelines);
router.post('/', authorize('pipelines', 'create'), requireProjectAccess, createPipeline);
router.post('/:pipelineId/run', authorize('pipelines', 'run'), requireProjectAccess, runPipeline);
router.get('/runs', authorize('pipelines', 'read'), requireProjectAccess, listPipelineRuns);
router.get('/runs/:runId', authorize('pipelines', 'read'), requireProjectAccess, getPipelineRun);

export default router;

