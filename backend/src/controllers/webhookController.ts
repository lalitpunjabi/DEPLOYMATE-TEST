import { Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../config/db';
import { executePipelineRun } from '../services/pipelineEngine';
import { EventBus } from '../services/eventBus';
import { sendSafeError } from '../utils/securityUtils';
import { insertAuditLog } from '../services/auditService';

const processedDeliveryIds = new Set<string>();

const ALLOWED_WEBHOOK_EVENTS = ['push', 'pull_request', 'ping'];

export async function handleGitHubWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers['x-hub-signature-256'] as string;
  const eventType = (req.headers['x-github-event'] as string) || 'push';
  const deliveryId = req.headers['x-github-delivery'] as string;
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  // 1. Mandatory Delivery ID Check
  if (!deliveryId || deliveryId.trim().length === 0) {
    res.status(400).json({ message: 'Missing X-GitHub-Delivery header.' });
    return;
  }

  // 2. Event Whitelist Check
  if (!ALLOWED_WEBHOOK_EVENTS.includes(eventType)) {
    res.status(200).json({ status: 'IGNORED', message: `Unsupported GitHub event type: ${eventType}` });
    return;
  }

  // 3. Fail closed if webhook secret missing in production or verify HMAC signature
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      res.status(401).json({ message: 'Webhook authentication failed. Server webhook secret is unconfigured.' });
      return;
    }
  } else {
    if (!signature) {
      res.status(401).json({ message: 'Missing GitHub HMAC signature header.' });
      return;
    }

    try {
      const hmac = crypto.createHmac('sha256', secret);
      const rawPayload = (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      const digest = 'sha256=' + hmac.update(rawPayload).digest('hex');

      const sigBuffer = Buffer.from(signature, 'utf8');
      const digestBuffer = Buffer.from(digest, 'utf8');

      if (sigBuffer.length !== digestBuffer.length || !crypto.timingSafeEqual(sigBuffer, digestBuffer)) {
        res.status(401).json({ message: 'Invalid GitHub HMAC signature.' });
        return;
      }
    } catch {
      res.status(401).json({ message: 'Invalid GitHub HMAC signature.' });
      return;
    }
  }

  // 4. Persistent Replay Protection (AFTER HMAC signature verification)
  try {
    const delCheck = await query(
      `INSERT INTO webhook_deliveries (delivery_id) VALUES ($1) ON CONFLICT (delivery_id) DO NOTHING RETURNING delivery_id`,
      [deliveryId]
    );
    if (delCheck.rowCount === 0) {
      res.status(200).json({ status: 'IGNORED', message: 'Duplicate webhook delivery ID detected.' });
      return;
    }
  } catch {
    if (processedDeliveryIds.has(deliveryId)) {
      res.status(200).json({ status: 'IGNORED', message: 'Duplicate webhook delivery ID detected.' });
      return;
    }
    processedDeliveryIds.add(deliveryId);
  }

  // Ping event return safe response
  if (eventType === 'ping') {
    res.status(200).json({ status: 'SUCCESS', message: 'GitHub webhook ping pong successful.' });
    return;
  }

  const payload = req.body;
  if (!payload || !payload.repository) {
    res.status(400).json({ message: 'Invalid webhook payload structure.' });
    return;
  }

  const repoUrl = payload.repository.html_url || payload.repository.clone_url || '';
  const fullName = payload.repository.full_name || '';
  const branch = payload.ref ? payload.ref.replace('refs/heads/', '') : (payload.repository.default_branch || 'main');
  const commitSha = payload.after || (payload.head_commit ? payload.head_commit.id : 'sha-webhook');
  const commitMessage = payload.head_commit ? payload.head_commit.message : `Webhook trigger on event: ${eventType}`;
  const pusherName = payload.pusher ? payload.pusher.name : 'GitHub-Webhook';

  console.log(`[WEBHOOK] Received GitHub event "${eventType}" for repository "${repoUrl}" on branch "${branch}"`);

  try {
    // Exact deterministic repository matching (No LIMIT 1 fragile matching)
    const repoMatch = await query(
      `SELECT DISTINCT r.project_id, p.id as pipeline_id, p.name as pipeline_name
       FROM repositories r
       JOIN pipelines p ON p.project_id = r.project_id
       WHERE r.github_repo_url = $1 OR r.github_repo_url = $2 OR r.github_repo_url = $3`,
      [repoUrl, `https://github.com/${fullName}`, `git@github.com:${fullName}.git`]
    );

    if (repoMatch.rowCount === 0) {
      console.warn(`[WEBHOOK] No DEPLOYMATE project found matching repository "${repoUrl}"`);
      res.status(200).json({ 
        status: 'IGNORED', 
        message: `Webhook received but no registered project found for repo: ${repoUrl}` 
      });
      return;
    }

    if (repoMatch.rowCount && repoMatch.rowCount > 1) {
      res.status(400).json({ message: 'Ambiguous repository mapping: multiple projects match this repository URL.' });
      return;
    }

    const { project_id, pipeline_id, pipeline_name } = repoMatch.rows[0];

    // Atomic insert for pipeline_run record to eliminate COUNT(*) race conditions
    const runRes = await query(
      `INSERT INTO pipeline_runs (
         pipeline_id, 
         run_number, 
         status, 
         git_branch, 
         git_commit_sha, 
         git_commit_message, 
         triggered_by
       ) SELECT $1, COALESCE(MAX(run_number), 0) + 1, 'PENDING', $2, $3, $4, NULL
         FROM pipeline_runs WHERE pipeline_id = $1
       RETURNING id, run_number`,
      [pipeline_id, branch, commitSha, commitMessage]
    );

    const runId = runRes.rows[0].id;
    const runNumber = runRes.rows[0].run_number;

    // Record Audit Log entry (project-scoped for tenant isolation)
    await insertAuditLog({
      userId: null,
      action: 'WEBHOOK_PIPELINE_TRIGGER',
      resource: `Pipeline#${pipeline_id}`,
      resourceId: runId,
      projectId: project_id,
      details: { eventType, repoUrl, branch, commitSha, runId, pusher: pusherName, execution_mode: 'SIMULATED' },
      req,
    });

    // Emit EventBus event
    await EventBus.emit({
      eventType: 'WEBHOOK_RECEIVED',
      source: 'gitops',
      severity: 'INFO',
      resource: `Pipeline#${pipeline_id}`,
      metadata: { repoUrl, branch, commitSha, runId, project_id }
    });

    // Execute pipeline asynchronously
    executePipelineRun(runId, pipeline_id).catch((err) => {
      console.error(`[WEBHOOK] Pipeline run execution error:`, err);
    });

    res.status(202).json({
      status: 'ACCEPTED',
      message: `Triggered pipeline "${pipeline_name}" Run #${runNumber} via GitHub webhook`,
      run_id: runId,
      run_number: runNumber,
      pipeline_id: pipeline_id
    });
  } catch (err: any) {
    sendSafeError(res, err, 'Failed to process webhook.');
  }
}
