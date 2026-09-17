import { Router } from 'express';
import { failureAnalysis, logAnalysis, riskAssessment, pipelineGenerator, chatAssistant } from '../controllers/aiController';
import { createAiFixPr } from '../controllers/aiPrController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Secure all routes with JWT token authentication
router.use(authenticateToken);

router.post('/failure-analysis', failureAnalysis);
router.post('/log-analysis', logAnalysis);
router.post('/risk-assessment', riskAssessment);
router.post('/pipeline-generator', pipelineGenerator);
router.post('/chat', chatAssistant);
router.post('/create-fix-pr', createAiFixPr);

export default router;
