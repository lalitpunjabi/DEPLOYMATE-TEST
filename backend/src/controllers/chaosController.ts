import { Request, Response } from 'express';
import { query } from '../config/db';

export async function injectChaos(req: Request, res: Response): Promise<void> {
  const { name, scenario_type, target_resource, duration_seconds } = req.body;

  if (!name || !scenario_type || !target_resource || !duration_seconds) {
    res.status(400).json({ message: 'Name, scenario_type, target_resource, and duration_seconds are required.' });
    return;
  }

  try {
    console.log(`[Chaos Monkey] Starting Experiment: "${name}". Scenario: ${scenario_type} targeting "${target_resource}"...`);
    
    // Simulate a resilience score calculation
    // CPU_STRESS has lower score, POD_KILL is generally handled well (95+ score)
    let resilienceScore = 100;
    let description = '';

    if (scenario_type === 'CPU_STRESS') {
      resilienceScore = 84;
      description = 'Resource allocation limits delayed pod rescheduling. CPU usage spiked to 98% on target node.';
    } else if (scenario_type === 'POD_KILL') {
      resilienceScore = 98;
      description = 'ReplicaSet controller successfully spawned a replacement pod within 2.4s. Zero HTTP drops detected.';
    } else if (scenario_type === 'NETWORK_DELAY') {
      resilienceScore = 72;
      description = 'Latency threshold crossed (150ms delay). HTTP request queue limits saturated, minor HTTP 504 timeouts.';
    } else {
      resilienceScore = 90;
      description = 'Simulation experiment executed successfully.';
    }

    const reportJson = {
      execution_log: [
        `[00:00] Initializing stress agent inside container namespace`,
        `[00:05] Injecting scenario: ${scenario_type} on ${target_resource}`,
        `[00:30] Monitoring SLO targets. Latency spikes detected.`,
        `[01:00] Stress agent removed. Restoring namespace state.`,
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
         report_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        name,
        scenario_type,
        target_resource,
        Number(duration_seconds),
        'COMPLETED',
        resilienceScore,
        JSON.stringify(reportJson)
      ]
    );

    res.status(201).json({
      message: 'Chaos experiment executed successfully.',
      experiment: insertRes.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Chaos injection failed.', error: error.message });
  }
}

export async function getChaosHistory(_req: Request, res: Response): Promise<void> {
  try {
    const listRes = await query(`SELECT * FROM chaos_experiments ORDER BY executed_at DESC`);
    res.status(200).json(listRes.rows);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve chaos history.', error: error.message });
  }
}
