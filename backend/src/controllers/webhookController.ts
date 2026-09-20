import { Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../config/db';
import { executePipelineRun } from '../services/pipelineEngine';
import { EventBus } from '../services/eventBus';

export async function handleGitHubWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers['x-hub-signature-256'] as string;
  const eventType = (req.headers['x-github-event'] as string) || 'push';
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  // Fail closed if webhook secret missing in production
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
      const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

      const sigBuffer = Buffer.from(signature);
      const digestBuffer = Buffer.from(digest);

      if (sigBuffer.length !== digestBuffer.length || !crypto.timingSafeEqual(sigBuffer, digestBuffer)) {
        res.status(401).json({ message: 'Invalid GitHub HMAC signature.' });
        return;
      }
    } catch {
      res.status(401).json({ message: 'Invalid GitHub HMAC signature.' });
      return;
    }
  }

  const payload = req.body;
  if (!payload || !payload.repository) {
    res.status(400).json({ message: 'Invalid webhook payload structure.' });
    return;
  }

  const repoUrl = payload.repository.html_url || payload.repository.clone_url || '';
  const branch = payload.ref ? payload.ref.replace('refs/heads/', '') : (payload.repository.default_branch || 'main');
  const commitSha = payload.after || (payload.head_commit ? payload.head_commit.id : 'sha-webhook');
  const commitMessage = payload.head_commit ? payload.head_commit.message : `Webhook trigger on event: ${eventType}`;
  const pusherName = payload.pusher ? payload.pusher.name : 'GitHub-Webhook';

  console.log(`[WEBHOOK] Received GitHub event "${eventType}" for repository "${repoUrl}" on branch "${branch}"`);

  try {
    // Find project pipeline matching repository URL
    const repoMatch = await query(
      `SELECT r.project_id, p.id as pipeline_id, p.name as pipeline_name
       FROM repositories r
       JOIN pipelines p ON p.project_id = r.project_id
       WHERE r.github_repo_url ILIKE $1 OR r.github_repo_url ILIKE $2
       LIMIT 1`,
      [`%${payload.repository.full_name}%`, `%${repoUrl}%`]
    );

    if (repoMatch.rowCount === 0) {
      console.warn(`[WEBHOOK] No DEPLOYMATE project found matching repository "${repoUrl}"`);
      res.status(200).json({ 
        status: 'IGNORED', 
        message: `Webhook received but no registered project found for repo: ${repoUrl}` 
      });
      return;
    }

    const { project_id, pipeline_id, pipeline_name } = repoMatch.rows[0];

    // Determine next run number
    const countRes = await query(
      `SELECT COUNT(*)::int as count FROM pipeline_runs WHERE pipeline_id = $1`,
      [pipeline_id]
    );
    const runNumber = (countRes.rows[0].count || 0) + 1;

    // Create pipeline run record
    const runRes = await query(
      `INSERT INTO pipeline_runs (
         pipeline_id, 
         run_number, 
         status, 
         git_branch, 
         git_commit_sha, 
         git_commit_message, 
         triggered_by
       ) VALUES ($1, $2, 'PENDING', $3, $4, $5, NULL)
       RETURNING id`,
      [pipeline_id, runNumber, branch, commitSha, commitMessage]
    );

    const runId = runRes.rows[0].id;

    // Record Audit Log entry
    await query(
      `INSERT INTO audit_logs (action, resource, details)
       VALUES ($1, $2, $3)`,
      [
        'WEBHOOK_PIPELINE_TRIGGER',
        `Pipeline#${pipeline_id}`,
        JSON.stringify({ eventType, repoUrl, branch, commitSha, runId, pusher: pusherName, project_id })
      ]
    );

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
    console.error('[WEBHOOK] Error processing GitHub webhook:', err);
    res.status(500).json({ message: 'Failed to process webhook', error: err.message });
  }
}
