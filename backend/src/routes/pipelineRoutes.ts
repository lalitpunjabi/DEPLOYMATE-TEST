import { Router } from 'express';
import { listPipelines, createPipeline, runPipeline, listPipelineRuns, getPipelineRun } from '../controllers/pipelineController';
import { authenticateToken, authorize } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.get('/', authorize('pipelines', 'read'), listPipelines);
router.post('/', authorize('pipelines', 'create'), createPipeline);
router.post('/:pipelineId/run', authorize('pipelines', 'run'), runPipeline);
router.get('/runs', authorize('pipelines', 'read'), listPipelineRuns);
router.get('/runs/:runId', authorize('pipelines', 'read'), getPipelineRun);

export default router;
