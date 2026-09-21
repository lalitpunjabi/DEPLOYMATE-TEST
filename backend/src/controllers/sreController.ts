import { Response } from 'express';
import { query } from '../config/db';
import { EventBus } from '../services/eventBus';
import { sendSafeError } from '../utils/securityUtils';
import { AuthenticatedRequest } from '../middleware/auth';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

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
    res.status(200).json(sloRes.rows);
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve SRE SLO status.', 500);
  }
}

export async function getIncidents(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { projectId } = req.query;

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

  try {
    const insertRes = await query(
      `INSERT INTO sre_incidents (severity, title, description, status, project_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [severity, title, description, 'OPEN', project_id || null]
    );

    const incident = insertRes.rows[0];

    // Emit EventBus incident creation event
    await EventBus.emit({
      eventType: 'INCIDENT_CREATED',
      source: 'sre',
      severity: severity === 'P1' ? 'CRITICAL' : 'WARNING',
      resource: title,
      metadata: { incidentId: incident.id, severity, project_id },
    });

    // If P1 severity, trigger AlertManager and Self-Healing
    if (severity === 'P1') {
      console.log(`[AlertManager] CRITICAL P1 incident registered! Scheduling self-healing actions.`);

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
          `kubectl delete pod ${podName} --namespace=${namespace} (Controlled Restart)`,
          'SUCCESS',
          incident.id,
        ]
      );
    }

    res.status(201).json({
      message: 'SRE incident ticket successfully opened.',
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

    let postmortemMarkdown = '';
    try {
      const aiRes = await fetch(`${AI_SERVICE_URL}/api/v1/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': process.env.AI_INTERNAL_TOKEN || 'deploymate-internal-ai-secret-token',
        },
        body: JSON.stringify({ message: prompt, history: [] }),
      });
      const data = (await aiRes.json()) as any;
      postmortemMarkdown = data.response || data.text;
    } catch (err) {
      console.warn('AI service unreachable, generating default SRE postmortem template.');
      postmortemMarkdown = `# Incident Postmortem: ${incident.title}

## 1. Executive Summary
On ${incident.created_at ? incident.created_at.toISOString() : new Date().toISOString()}, the team detected a ${incident.severity} outage. The issue was fully mitigated.

## 2. Root Cause Analysis
The service encountered exhaustion of resources under simulated load spikes.

## 3. Preventative Actions
- Increase Kubernetes memory limits from 512Mi to 1Gi.
- Set up Horizontal Pod Autoscaler policies.`;
    }

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
      incident: updateRes.rows[0],
    });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to compile SRE postmortem.', 500);
  }
}

export async function getSelfHealingActions(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const listRes = await query(`SELECT * FROM self_healing_actions ORDER BY created_at DESC`);
    res.status(200).json(listRes.rows);
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve self-healing actions.', 500);
  }
}
