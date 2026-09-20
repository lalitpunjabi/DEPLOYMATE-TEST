import { Router } from 'express';
import { failureAnalysis, logAnalysis, riskAssessment, pipelineGenerator, chatAssistant } from '../controllers/aiController';
import { createAiFixPr } from '../controllers/aiPrController';
import { authenticateToken, checkPermission } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.post('/failure-analysis', checkPermission('pipeline.read'), failureAnalysis);
router.post('/log-analysis', checkPermission('pipeline.read'), logAnalysis);
router.post('/risk-assessment', checkPermission('deployment.read'), riskAssessment);
router.post('/pipeline-generator', checkPermission('pipeline.create'), pipelineGenerator);
router.post('/chat', checkPermission('pipeline.read'), chatAssistant);
router.post('/create-fix-pr', checkPermission('ai.remediation.approve'), createAiFixPr);

export default router;
