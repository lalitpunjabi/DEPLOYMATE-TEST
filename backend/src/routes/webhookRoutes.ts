import { Router } from 'express';
import { handleGitHubWebhook } from '../controllers/webhookController';

const router = Router();

// POST /api/v1/webhooks/github
router.post('/github', handleGitHubWebhook);

export default router;
