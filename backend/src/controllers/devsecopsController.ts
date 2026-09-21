import { Request, Response } from 'express';
import { query } from '../config/db';
import { sendSafeError, isValidUuid } from '../utils/securityUtils';

const SONAR_RATINGS = ['A', 'B', 'C', 'D', 'F'];

function isValidNonNegativeInt(value: unknown): boolean {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 100000;
}

export interface ScanThreshold {
  pipeline_id: string;
  fail_on_critical_count: number;
  fail_on_high_count: number;
  fail_on_sonar_rating: string; // 'A', 'B', 'C', 'D', 'F'
}

export async function setScanThresholds(req: Request, res: Response): Promise<void> {
  const { pipeline_id, fail_on_critical_count, fail_on_high_count, fail_on_sonar_rating } = req.body;

  if (!pipeline_id) {
    res.status(400).json({ message: 'Pipeline ID is required.' });
    return;
  }

  if (!isValidUuid(pipeline_id)) {
    res.status(400).json({ message: 'Invalid pipeline ID format.' });
    return;
  }

  if (fail_on_critical_count !== undefined && !isValidNonNegativeInt(fail_on_critical_count)) {
    res.status(400).json({ message: 'fail_on_critical_count must be a non-negative integer.' });
    return;
  }

  if (fail_on_high_count !== undefined && !isValidNonNegativeInt(fail_on_high_count)) {
    res.status(400).json({ message: 'fail_on_high_count must be a non-negative integer.' });
    return;
  }

  if (fail_on_sonar_rating !== undefined && !SONAR_RATINGS.includes(fail_on_sonar_rating)) {
    res.status(400).json({ message: `fail_on_sonar_rating must be one of: ${SONAR_RATINGS.join(', ')}.` });
    return;
  }

  const crit = fail_on_critical_count !== undefined ? Number(fail_on_critical_count) : 0;
  const high = fail_on_high_count !== undefined ? Number(fail_on_high_count) : 2;
  const sonar = fail_on_sonar_rating || 'C';

  try {
    await query(
      `INSERT INTO security_gate_policies (pipeline_id, fail_on_critical_count, fail_on_high_count, fail_on_sonar_rating, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (pipeline_id) 
       DO UPDATE SET fail_on_critical_count = $2, fail_on_high_count = $3, fail_on_sonar_rating = $4, updated_at = NOW()`,
      [pipeline_id, crit, high, sonar]
    );

    res.status(200).json({
      message: 'DevSecOps security gate policy successfully updated.',
      thresholds: {
        pipeline_id,
        fail_on_critical_count: crit,
        fail_on_high_count: high,
        fail_on_sonar_rating: sonar
      }
    });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to configure scan thresholds.');
  }
}

export async function getPipelineSecurityReport(req: Request, res: Response): Promise<void> {
  const { runId } = req.params;

  if (!runId) {
    res.status(400).json({ message: 'Pipeline Run ID is required.' });
    return;
  }

  if (!isValidUuid(runId)) {
    res.status(400).json({ message: 'Invalid pipeline run ID format.' });
    return;
  }

  try {
    const scanRes = await query(
      `SELECT * FROM pipeline_security_scans 
       WHERE pipeline_run_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [runId]
    );

    if (scanRes.rowCount === 0) {
      // Hardening spec §13: never fabricate placeholder CVEs or scores. When no scan
      // record exists yet, honestly report NOT_EXECUTED.
      res.status(404).json({
        message: 'No security scan results exist for this pipeline run yet.',
        scan_status: 'NOT_EXECUTED',
        execution_mode: 'NOT_EXECUTED',
        pipeline_run_id: runId,
        vulnerabilities: [],
      });
      return;
    }

    res.status(200).json(scanRes.rows[0]);
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve security report.');
  }
}

export async function getThresholdsForPipeline(pipelineId: string): Promise<ScanThreshold> {
  try {
    const res = await query(
      `SELECT fail_on_critical_count, fail_on_high_count, fail_on_sonar_rating 
       FROM security_gate_policies WHERE pipeline_id = $1`,
      [pipelineId]
    );

    if (res.rowCount && res.rowCount > 0) {
      return {
        pipeline_id: pipelineId,
        fail_on_critical_count: res.rows[0].fail_on_critical_count,
        fail_on_high_count: res.rows[0].fail_on_high_count,
        fail_on_sonar_rating: res.rows[0].fail_on_sonar_rating
      };
    }
  } catch (err) {
    console.error('Failed to fetch security gate policies from DB:', err);
  }

  // Default fallback thresholds
  return {
    pipeline_id: pipelineId,
    fail_on_critical_count: 0,
    fail_on_high_count: 2,
    fail_on_sonar_rating: 'C'
  };
}
