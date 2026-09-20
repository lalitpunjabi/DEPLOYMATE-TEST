import { Response } from 'express';
import { query } from '../config/db';
import { EventBus } from '../services/eventBus';
import { AuthenticatedRequest } from '../middleware/auth';
import { sendSafeError } from '../utils/securityUtils';

export async function injectChaos(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { name, scenario_type, target_resource, duration_seconds, project_id } = req.body;

  if (!name || !scenario_type || !target_resource || !duration_seconds) {
    res.status(400).json({ message: 'Name, scenario_type, target_resource, and duration_seconds are required.' });
    return;
  }

  const duration = Number(duration_seconds);
  if (duration > 300) {
    res.status(400).json({ message: 'Safety Constraint: Maximum experiment duration is capped at 300 seconds.' });
    return;
  }

  try {
    console.log(`[Resilience Lab] Executing Simulated Resilience Experiment: "${name}". Scenario: ${scenario_type} targeting "${target_resource}"...`);
    
    let resilienceScore = 100;
    let description = '';

    if (scenario_type === 'CPU_STRESS') {
      resilienceScore = 84;
      description = 'Resource allocation limits delayed pod rescheduling (Simulated). CPU usage spiked to 98% on target node.';
    } else if (scenario_type === 'POD_KILL') {
      resilienceScore = 98;
      description = 'ReplicaSet controller successfully spawned a replacement pod within 2.4s (Simulated). Zero HTTP drops detected.';
    } else if (scenario_type === 'NETWORK_DELAY') {
      resilienceScore = 72;
      description = 'Latency threshold crossed (150ms delay, Simulated). HTTP request queue limits saturated, minor HTTP 504 timeouts.';
    } else {
      resilienceScore = 90;
      description = 'Resilience experiment simulated successfully.';
    }

    const reportJson = {
      execution_mode: 'SIMULATED',
      execution_log: [
        `[00:00] Initializing simulated stress agent inside container namespace`,
        `[00:05] Injecting scenario: ${scenario_type} on ${target_resource} (Simulated)`,
        `[00:30] Monitoring SLO targets. Latency spikes detected.`,
        `[01:00] Simulated stress agent removed. Restoring namespace state.`,
        `[01:15] Completed. SRE metrics stabilized.`
      ],
      findings: description,
      resilience_indicators: {
        http_availability: resilienceScore > 85 ? '100.00%' : '98.40%',
        avg_latency_ms: resilienceScore > 90 ? '45ms' : '285ms'
      }
    };

    const insertRes = await query(
      `INSERT INTO chaos_experiments (
         name, 
         scenario_type, 
         target_resource, 
         duration_seconds, 
         status, 
         resilience_score, 
         report_json,
         project_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        name,
        scenario_type,
        target_resource,
        duration,
        'COMPLETED',
        resilienceScore,
        JSON.stringify(reportJson),
        project_id || null
      ]
    );

    // Emit EventBus event
    await EventBus.emit({
      eventType: 'RESILIENCE_EXPERIMENT_COMPLETED',
      source: 'chaos',
      severity: resilienceScore < 80 ? 'WARNING' : 'INFO',
      resource: target_resource,
      metadata: { name, scenario_type, resilienceScore, execution_mode: 'SIMULATED' }
    });

    res.status(201).json({
      message: 'Simulated resilience experiment executed successfully.',
      execution_mode: 'SIMULATED',
      experiment: insertRes.rows[0]
    });
  } catch (error: any) {
    sendSafeError(res, error, 'Resilience experiment execution failed.');
  }
}

export async function getChaosHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { projectId } = req.query;

  try {
    let listRes;
    if (projectId) {
      listRes = await query(`SELECT * FROM chaos_experiments WHERE project_id = $1 ORDER BY executed_at DESC`, [projectId]);
    } else if (req.user?.role === 'Super Admin') {
      listRes = await query(`SELECT * FROM chaos_experiments ORDER BY executed_at DESC`);
    } else {
      listRes = await query(
        `SELECT c.* FROM chaos_experiments c
         WHERE c.project_id IN (
           SELECT id FROM projects WHERE owner_id = $1
           UNION
           SELECT project_id FROM project_members WHERE user_id = $1
         ) OR c.project_id IS NULL
         ORDER BY c.executed_at DESC`,
        [req.user?.id]
      );
    }
    res.status(200).json(listRes.rows.map(row => ({ ...row, execution_mode: 'SIMULATED' })));
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve resilience history.');
  }
}
