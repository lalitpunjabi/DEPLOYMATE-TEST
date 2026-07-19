import { Request, Response } from 'express';
import { query } from '../config/db';

export async function getGitOpsSyncStatus(req: Request, res: Response): Promise<void> {
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

    // Default status if no sync history has run yet
    const history = syncRes.rows;
    const currentStatus = history.length > 0 ? history[0] : null;

    res.status(200).json({
      app_name: currentStatus ? currentStatus.app_name : 'deploymate-core-service',
      sync_status: currentStatus ? currentStatus.sync_status : 'Synced',
      cluster_health: currentStatus ? currentStatus.cluster_health : 'Healthy',
      drift_detected: currentStatus ? currentStatus.drift_detected : false,
      drift_details: currentStatus && currentStatus.drift_detected ? currentStatus.drift_details_json : null,
      history: history
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve GitOps status.', error: error.message });
  }
}

export async function triggerGitOpsSync(req: Request, res: Response): Promise<void> {
  const { project_id, app_name } = req.body;

  if (!project_id || !app_name) {
    res.status(400).json({ message: 'Project ID and App Name are required.' });
    return;
  }

  try {
    // Generate simulated sync duration and sha
    const revisionSha = 'git-' + Math.random().toString(16).substring(2, 10);
    const syncDuration = Math.floor(Math.random() * 10) + 4; // 4 to 13 seconds

    // Add entry to DB
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
        JSON.stringify({}),
        syncDuration
      ]
    );

    res.status(200).json({
      message: 'GitOps synchronization completed successfully.',
      sync: insertRes.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({ message: 'GitOps sync execution failed.', error: error.message });
  }
}

export async function forceDriftState(req: Request, res: Response): Promise<void> {
  const { project_id, app_name } = req.body;

  if (!project_id || !app_name) {
    res.status(400).json({ message: 'Project ID and App Name are required.' });
    return;
  }

  try {
    const driftDetails = {
      kind: 'Deployment',
      name: app_name,
      diff: `- replicas: 3\n+ replicas: 1\n- image: deploymate-api:latest\n+ image: deploymate-api:debug`
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

    res.status(200).json({
      message: 'Simulated GitOps drift state triggered.',
      sync: insertRes.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Drift simulation setup failed.', error: error.message });
  }
}
