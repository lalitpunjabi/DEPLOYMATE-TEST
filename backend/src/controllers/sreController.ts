import { Response } from 'express';
import { query } from '../config/db';
import { EventBus } from '../services/eventBus';
import { sendSafeError, isValidUuid } from '../utils/securityUtils';
import { AuthenticatedRequest } from '../middleware/auth';
import { aiService, isAiUnavailable } from '../services/aiService';
import { insertAuditLog } from '../services/auditService';

const VALID_SEVERITIES = ['P1', 'P2', 'P3', 'P4'];

export async function getSloHealth(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const checkRes = await query(`SELECT * FROM sre_slo_targets`);
    if (checkRes.rowCount === 0) {
      await query(`
        INSERT INTO sre_slo_targets (service_name, metric_type, slo_target_percentage, sli_value_current, error_budget_remaining_percentage, burn_rate)
        VALUES 
          ('payment-api-service', 'AVAILABILITY', 99.900, 99.954, 85.400, 1.00),
          ('payment-api-service', 'LATENCY', 99.000, 98.450, 42.100, 3.50),
          ('frontend-dashboard-ui', 'AVAILABILITY', 99.500, 99.720, 100.000, 0.80),
          ('fastapi-copilot-service', 'ERROR_RATE', 99.000, 98.920, 22.800, 14.20)
      `);
    }

    const sloRes = await query(`SELECT * FROM sre_slo_targets ORDER BY service_name, metric_type`);
    // Honest labeling: SLI values are stored demo seed figures, not measured from live metrics.
    res.setHeader('X-Execution-Mode', 'SIMULATED');
    res.status(200).json({
      execution_mode: 'SIMULATED',
      notice: 'SLO targets and SLI/burn-rate values are stored reference figures, not measurements from a live metrics pipeline.',
      targets: sloRes.rows,
    });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve SRE SLO status.', 500);
  }
}

export async function getIncidents(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { projectId } = req.query;

  if (projectId && !isValidUuid(String(projectId))) {
    res.status(400).json({ message: 'Invalid project ID format.' });
    return;
  }

  try {
    let incidentRes;
    if (projectId) {
      incidentRes = await query(`SELECT * FROM sre_incidents WHERE project_id = $1 ORDER BY created_at DESC`, [projectId]);
    } else if (req.user?.role === 'Super Admin') {
      incidentRes = await query(`SELECT * FROM sre_incidents ORDER BY created_at DESC`);
    } else {
      incidentRes = await query(
        `SELECT i.* FROM sre_incidents i
         WHERE i.project_id IN (
           SELECT id FROM projects WHERE owner_id = $1
           UNION
           SELECT project_id FROM project_members WHERE user_id = $1
         )
         ORDER BY i.created_at DESC`,
        [req.user?.id]
      );
    }
    res.status(200).json(incidentRes.rows);
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve SRE incidents.', 500);
  }
}

export async function createIncident(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { severity, title, description, project_id } = req.body;

  if (!severity || !title || !description) {
    res.status(400).json({ message: 'Severity, title, and description are required.' });
    return;
  }

  if (!project_id && req.user?.role !== 'Super Admin') {
    res.status(400).json({ message: 'Project ID is required for incident creation.' });
    return;
  }

  if (!VALID_SEVERITIES.includes(severity)) {
    res.status(400).json({ message: 'Invalid severity. Must be one of: P1, P2, P3, P4.' });
    return;
  }

  if (String(title).length > 255 || String(title).trim().length === 0) {
    res.status(400).json({ message: 'Title is required and must not exceed 255 characters.' });
    return;
  }

  if (String(description).length > 10000) {
    res.status(400).json({ message: 'Description must not exceed 10,000 characters.' });
    return;
  }

  if (project_id && !isValidUuid(project_id)) {
    res.status(400).json({ message: 'Invalid project ID format.' });
    return;
  }

  try {
    const insertRes = await query(
      `INSERT INTO sre_incidents (severity, title, description, status, project_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [severity, title, description, 'OPEN', project_id || null]
    );

    const incident = insertRes.rows[0];

    // Project-scoped audit trail
    await insertAuditLog({
      userId: req.user?.id ?? null,
      action: 'INCIDENT_CREATED',
      resource: 'SRE_INCIDENT',
      resourceId: incident.id,
      projectId: incident.project_id,
      details: { severity, title },
      req,
    });

    // Emit EventBus incident creation event
    await EventBus.emit({
      eventType: 'INCIDENT_CREATED',
      source: 'sre',
      severity: severity === 'P1' ? 'CRITICAL' : 'WARNING',
      resource: title,
      metadata: { incidentId: incident.id, severity, project_id },
    });

    // If P1 severity, register a SIMULATED self-healing recommendation (hardening spec §11:
    // the platform never executes or fakes cluster remediation commands)
    if (severity === 'P1') {
      console.log(`[AlertManager] CRITICAL P1 incident registered. Logging simulated self-healing recommendation.`);

      const podName = 'deploymate-api-5d7f8c9b-abc12';
      const namespace = 'default';
      const anomaly = 'OOMKilled / CrashLoopBackOff';

      await query(
        `INSERT INTO self_healing_actions (pod_name, namespace, anomaly_detected, action_taken, status, incident_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          podName,
          namespace,
          anomaly,
          `Recommended (SIMULATED): kubectl delete pod ${podName} -n ${namespace}`,
          'SIMULATED',
          incident.id,
        ]
      );
    }

    res.status(201).json({
      message: 'SRE incident ticket successfully opened.',
      execution_mode: 'SIMULATED',
      incident,
    });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to record SRE incident.', 500);
  }
}

export async function generatePostmortem(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  if (!id) {
    res.status(400).json({ message: 'Incident ID parameter is required.' });
    return;
  }

  try {
    const incRes = await query(`SELECT * FROM sre_incidents WHERE id = $1`, [id]);
    if (incRes.rowCount === 0) {
      res.status(404).json({ message: 'Incident not found.' });
      return;
    }

    const incident = incRes.rows[0];

    const prompt = `Construct an enterprise DevOps Postmortem Report in markdown format. 
Incident Details:
- Severity: ${incident.severity}
- Title: ${incident.title}
- Description: ${incident.description}
Provide:
1. Executive Summary
2. Root Cause Analysis
3. Immediate Resolution Actions
4. Long-term Preventative Measures`;

    // Hardening spec §5/§13: no unlabeled fabricated postmortem fallback.
    // If the AI engine is unavailable we answer 503 DEGRADED instead.
    let aiResult: { response?: string; text?: string; execution_mode?: string };
    try {
      aiResult = await aiService.chat(prompt, []);
    } catch (err) {
      if (isAiUnavailable(err)) {
        res.status(503).json({
          execution_mode: 'DEGRADED',
          message: 'AI service temporarily unavailable; no postmortem was generated. Incident left OPEN.',
        });
        return;
      }
      throw err;
    }

    const postmortemMarkdown = `<!-- execution_mode=${aiResult.execution_mode || 'SIMULATED'} -->\n\n` +
      (aiResult.response || aiResult.text || '');

    const updateRes = await query(
      `UPDATE sre_incidents 
       SET postmortem_report = $1, status = 'RESOLVED', resolved_at = NOW() 
       WHERE id = $2 RETURNING *`,
      [postmortemMarkdown, id]
    );

    // Emit EventBus event
    await EventBus.emit({
      eventType: 'INCIDENT_RESOLVED',
      source: 'sre',
      severity: 'INFO',
      resource: incident.title,
      metadata: { incidentId: id },
    });

    res.status(200).json({
      message: 'Incident postmortem compiled and ticket marked as RESOLVED.',
      execution_mode: aiResult.execution_mode || 'SIMULATED',
      incident: updateRes.rows[0],
    });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to compile SRE postmortem.', 500);
  }
}

export async function getSelfHealingActions(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { projectId } = req.query;

  if (projectId && !isValidUuid(String(projectId))) {
    res.status(400).json({ message: 'Invalid project ID format.' });
    return;
  }

  try {
    let listRes;
    if (projectId) {
      listRes = await query(
        `SELECT sha.* FROM self_healing_actions sha
         JOIN sre_incidents si ON sha.incident_id = si.id
         WHERE si.project_id = $1
         ORDER BY sha.created_at DESC`,
        [projectId]
      );
    } else if (req.user?.role === 'Super Admin') {
      listRes = await query(`SELECT * FROM self_healing_actions ORDER BY created_at DESC`);
    } else {
      // Tenant isolation: only actions linked to incidents in the caller's projects
      listRes = await query(
        `SELECT sha.* FROM self_healing_actions sha
         JOIN sre_incidents si ON sha.incident_id = si.id
         WHERE si.project_id IN (
           SELECT id FROM projects WHERE owner_id = $1
           UNION
           SELECT project_id FROM project_members WHERE user_id = $1
         )
         ORDER BY sha.created_at DESC`,
        [req.user?.id]
      );
    }
    res.setHeader('X-Execution-Mode', 'SIMULATED');
    res.status(200).json({
      execution_mode: 'SIMULATED',
      notice: 'Self-healing actions are simulated recommendations. No remediation commands were executed against any cluster.',
      actions: listRes.rows,
    });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve self-healing actions.', 500);
  }
}
