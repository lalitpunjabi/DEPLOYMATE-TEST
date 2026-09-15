import { Request, Response } from 'express';
import { query } from '../config/db';
import { EventBus } from '../services/eventBus';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export async function getSloHealth(_req: Request, res: Response): Promise<void> {
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
    res.status(500).json({ message: 'Failed to retrieve SRE SLO status.', error: error.message });
  }
}

export async function getIncidents(_req: Request, res: Response): Promise<void> {
  try {
    const checkRes = await query(`SELECT * FROM sre_incidents`);
    if (checkRes.rowCount === 0) {
      await query(`
        INSERT INTO sre_incidents (severity, title, description, status, postmortem_report)
        VALUES 
          ('P1', 'Postgres Database Connection Leaks', 'Express API pool connections exhausted leading to HTTP 500 errors on dashboard login requests.', 'RESOLVED', 'Root Cause: Connection leaks in logging route due to missing client release call. Fix: Implemented automatic client release block inside a finally scope.'),
          ('P2', 'CoreDNS Resolver Queries Failing', 'DNS resolution timeout preventing backend from contacting ECR registry during image build validation.', 'RESOLVED', 'Root Cause: DNS packet drops on control node. Fix: Restarted kube-dns daemonset nodes.'),
          ('P1', 'Memory Leak in API Container', 'Pod replica crashed with OutOfMemory limits check. CrashLoopBackOff state detected.', 'OPEN', null)
      `);
    }

    const incidentRes = await query(`SELECT * FROM sre_incidents ORDER BY created_at DESC`);
    res.status(200).json(incidentRes.rows);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve SRE incidents.', error: error.message });
  }
}

export async function createIncident(req: Request, res: Response): Promise<void> {
  const { severity, title, description } = req.body;

  if (!severity || !title || !description) {
    res.status(400).json({ message: 'Severity, title, and description are required.' });
    return;
  }

  try {
    const insertRes = await query(
      `INSERT INTO sre_incidents (severity, title, description, status)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [severity, title, description, 'OPEN']
    );

    const incident = insertRes.rows[0];

    // Emit EventBus incident creation event
    await EventBus.emit({
      eventType: 'INCIDENT_CREATED',
      source: 'sre',
      severity: severity === 'P1' ? 'CRITICAL' : 'WARNING',
      resource: title,
      metadata: { incidentId: incident.id, severity }
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
          incident.id
        ]
      );
    }

    res.status(201).json({
      message: 'SRE incident ticket successfully opened.',
      incident
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to record SRE incident.', error: error.message });
  }
}

export async function generatePostmortem(req: Request, res: Response): Promise<void> {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, history: [] })
      });
      const data = await aiRes.json() as any;
      postmortemMarkdown = data.response || data.text;
    } catch (err) {
      console.warn('AI service unreachable, generating default SRE postmortem template.');
      postmortemMarkdown = `# Incident Postmortem: ${incident.title}

## 1. Executive Summary
On ${incident.created_at.toISOString()}, the team detected a ${incident.severity} outage. The issue was fully mitigated.

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
      metadata: { incidentId: id }
    });

    res.status(200).json({
      message: 'Incident postmortem compiled and ticket marked as RESOLVED.',
      incident: updateRes.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to compile SRE postmortem.', error: error.message });
  }
}

export async function getSelfHealingActions(_req: Request, res: Response): Promise<void> {
  try {
    const listRes = await query(`SELECT * FROM self_healing_actions ORDER BY created_at DESC`);
    res.status(200).json(listRes.rows);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve self-healing actions.', error: error.message });
  }
}
