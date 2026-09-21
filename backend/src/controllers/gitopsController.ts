import crypto from 'crypto';
import { Response } from 'express';
import { query } from '../config/db';
import { EventBus } from '../services/eventBus';
import { AuthenticatedRequest } from '../middleware/auth';
import { sendSafeError } from '../utils/securityUtils';

export async function getGitOpsSyncStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { projectId } = req.query;

  if (!projectId) {
    res.status(400).json({ message: 'Project ID is required.' });
    return;
  }

  try {
    // Check if we have synchronization history in DB for this project
    const syncRes = await query(
      `SELECT * FROM gitops_sync_history 
       WHERE project_id = $1 
       ORDER BY created_at DESC`,
      [projectId]
    );

    const history = syncRes.rows;
    const currentStatus = history.length > 0 ? history[0] : null;

    res.status(200).json({
      execution_mode: 'SIMULATED',
      app_name: currentStatus ? currentStatus.app_name : 'deploymate-core-service',
      sync_status: currentStatus ? currentStatus.sync_status : 'Synced',
      cluster_health: currentStatus ? currentStatus.cluster_health : 'Healthy',
      drift_detected: currentStatus ? currentStatus.drift_detected : false,
      drift_details: currentStatus && currentStatus.drift_detected ? currentStatus.drift_details_json : null,
      history: history
    });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve GitOps status.');
  }
}

export async function triggerGitOpsSync(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { project_id, app_name } = req.body;

  if (!project_id || !app_name) {
    res.status(400).json({ message: 'Project ID and App Name are required.' });
    return;
  }

  try {
    const revisionSha = 'git-' + crypto.randomBytes(4).toString('hex');
    const syncDuration = crypto.randomInt(3, 9);

    const insertRes = await query(
      `INSERT INTO gitops_sync_history (
         project_id, 
         app_name, 
         revision_sha, 
         sync_status, 
         cluster_health, 
         drift_detected, 
         drift_details_json, 
         sync_duration_seconds
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        project_id,
        app_name,
        revisionSha,
        'Synced',
        'Healthy',
        false,
        JSON.stringify({ desired_replicas: 3, live_replicas: 3, status: 'RECONCILED', execution_mode: 'SIMULATED' }),
        syncDuration
      ]
    );

    // Emit Global EventBus reconciliation event
    await EventBus.emit({
      eventType: 'GITOPS_RECONCILED',
      source: 'gitops',
      severity: 'INFO',
      resource: app_name,
      metadata: { revisionSha, syncDuration, execution_mode: 'SIMULATED' }
    });

    res.status(200).json({
      message: 'GitOps synchronization and cluster state reconciliation completed (SIMULATED MODE).',
      execution_mode: 'SIMULATED',
      sync: insertRes.rows[0]
    });
  } catch (error: any) {
    sendSafeError(res, error, 'GitOps sync execution failed.');
  }
}

export async function forceDriftState(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { project_id, app_name } = req.body;

  if (!project_id || !app_name) {
    res.status(400).json({ message: 'Project ID and App Name are required.' });
    return;
  }

  try {
    const driftDetails = {
      kind: 'Deployment',
      name: app_name,
      diff: `- replicas: 3\n+ replicas: 1\n- image: deploymate-api:latest\n+ image: deploymate-api:debug`,
      desired_spec: { replicas: 3, image: 'deploymate-api:latest' },
      live_spec: { replicas: 1, image: 'deploymate-api:debug' },
      execution_mode: 'SIMULATED'
    };

    const insertRes = await query(
      `INSERT INTO gitops_sync_history (
         project_id, 
         app_name, 
         revision_sha, 
         sync_status, 
         cluster_health, 
         drift_detected, 
         drift_details_json, 
         sync_duration_seconds
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        project_id,
        app_name,
        'git-drift-revert',
        'OutOfSync',
        'Healthy',
        true,
        JSON.stringify(driftDetails),
        2
      ]
    );

    // Emit Global EventBus drift event
    await EventBus.emit({
      eventType: 'GITOPS_DRIFT_DETECTED',
      source: 'gitops',
      severity: 'WARNING',
      resource: app_name,
      metadata: { driftDetails, execution_mode: 'SIMULATED' }
    });

    res.status(200).json({
      message: 'GitOps configuration drift detected (SIMULATED MODE).',
      execution_mode: 'SIMULATED',
      sync: insertRes.rows[0]
    });
  } catch (error: any) {
    sendSafeError(res, error, 'Drift simulation setup failed.');
  }
}
