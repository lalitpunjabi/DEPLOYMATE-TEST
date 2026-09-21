import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { query } from '../config/db';
import { executePipelineRun } from '../services/pipelineEngine';
import { sendSafeError } from '../utils/securityUtils';

export async function listPipelines(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { projectId } = req.query;

  if (!projectId) {
    res.status(400).json({ message: 'projectId is required.' });
    return;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(projectId as string)) {
    res.status(200).json([]);
    return;
  }

  try {
    const pipelinesRes = await query(
      'SELECT id, name, definition, is_enabled, created_at FROM pipelines WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId]
    );

    res.status(200).json(pipelinesRes.rows);
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve pipelines.');
  }
}

export async function createPipeline(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { projectId, name, definition } = req.body;

  if (!projectId || !name) {
    res.status(400).json({ message: 'projectId and pipeline name are required.' });
    return;
  }

  try {
    const defaultDefinition = definition || [
      { name: 'Source', status: 'PENDING' },
      { name: 'Build', status: 'PENDING' },
      { name: 'Test', status: 'PENDING' },
      { name: 'Code Quality', status: 'PENDING' },
      { name: 'Security Scan', status: 'PENDING' },
      { name: 'Docker Build', status: 'PENDING' },
      { name: 'Image Push', status: 'PENDING' },
      { name: 'Deploy', status: 'PENDING' }
    ];

    const insertRes = await query(
      `INSERT INTO pipelines (project_id, name, definition) 
       VALUES ($1, $2, $3) 
       RETURNING id, name, definition, created_at`,
      [projectId, name, JSON.stringify(defaultDefinition)]
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to create pipeline.');
  }
}

export async function runPipeline(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { pipelineId } = req.params;

  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  try {
    // Check if pipeline exists
    const pipelineCheck = await query('SELECT project_id, name, definition FROM pipelines WHERE id = $1', [pipelineId]);
    if (pipelineCheck.rowCount === 0) {
      res.status(404).json({ message: 'Pipeline not found.' });
      return;
    }

    const { name } = pipelineCheck.rows[0];

    // Create a new pipeline run entry in PostgreSQL
    const runRes = await query(
      `INSERT INTO pipeline_runs (pipeline_id, status, trigger_type, triggered_by, git_branch, logs)
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, run_number, status, trigger_type, created_at`,
      [pipelineId, 'PENDING', 'MANUAL', req.user.id, 'main', '']
    );

    const newRun = runRes.rows[0];

    // Run the pipeline engine asynchronously in background
    executePipelineRun(newRun.id, pipelineId).catch((err) => {
      console.error(`Asynchronous Pipeline Run ${newRun.id} failed:`, err);
    });

    // Create audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, resource, resource_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'TRIGGER',
        'PIPELINE_RUN',
        newRun.id,
        JSON.stringify({ pipelineName: name, runNumber: newRun.run_number })
      ]
    );

    res.status(201).json({
      message: 'Pipeline run triggered successfully.',
      runId: newRun.id,
      runNumber: newRun.run_number,
      status: newRun.status,
      created_at: newRun.created_at
    });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to trigger pipeline run.');
  }
}

export async function listPipelineRuns(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { pipelineId } = req.query;

  if (!pipelineId) {
    res.status(400).json({ message: 'pipelineId query parameter is required.' });
    return;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(pipelineId as string)) {
    res.status(200).json([]);
    return;
  }

  try {
    const runsRes = await query(
      `SELECT r.id, r.run_number, r.status, r.trigger_type, r.git_branch, r.git_commit_sha, 
              r.git_commit_message, r.started_at, r.completed_at, u.name as triggered_by_user
       FROM pipeline_runs r
       LEFT JOIN users u ON r.triggered_by = u.id
       WHERE r.pipeline_id = $1
       ORDER BY r.run_number DESC`,
      [pipelineId]
    );

    res.status(200).json(runsRes.rows);
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve pipeline runs.');
  }
}

export async function getPipelineRun(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { runId } = req.params;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(runId)) {
    res.status(404).json({ message: 'Pipeline run not found.' });
    return;
  }

  try {
    const runRes = await query(
      `SELECT r.id, r.run_number, r.status, r.trigger_type, r.git_branch, r.git_commit_sha,
              r.git_commit_message, r.logs, r.started_at, r.completed_at,
              p.name as pipeline_name, p.definition as pipeline_definition, p.project_id
       FROM pipeline_runs r
       JOIN pipelines p ON r.pipeline_id = p.id
       WHERE r.id = $1`,
      [runId]
    );

    if (runRes.rowCount === 0) {
      res.status(404).json({ message: 'Pipeline run not found.' });
      return;
    }

    res.status(200).json(runRes.rows[0]);
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve pipeline run details.');
  }
}
