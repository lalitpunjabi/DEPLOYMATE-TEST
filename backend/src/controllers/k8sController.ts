import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { k8sService } from '../services/k8sService';
import { query } from '../config/db';
import { EventBus } from '../services/eventBus';
import { sendSafeError } from '../utils/securityUtils';
import { insertAuditLog } from '../services/auditService';

/** Resolve the owning project of a cluster namespace via tracked deployments (null when unmapped). */
async function resolveNamespaceProjectId(namespace: string): Promise<string | null> {
  try {
    const nsRes = await query('SELECT DISTINCT project_id FROM deployments WHERE namespace = $1 AND project_id IS NOT NULL', [namespace]);
    return nsRes.rowCount === 1 ? nsRes.rows[0].project_id : null;
  } catch {
    return null;
  }
}

export async function getNamespaces(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await k8sService.getNamespaces();
    res.status(200).json({ namespaces: result.data, execution_mode: result.execution_mode, ...(result.notice ? { notice: result.notice } : {}) });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve namespaces.', 500);
  }
}

export async function getPods(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { namespace } = req.params;
  try {
    const result = await k8sService.getPods(namespace || 'default');
    res.status(200).json({ pods: result.data, execution_mode: result.execution_mode, ...(result.notice ? { notice: result.notice } : {}) });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve pods.', 500);
  }
}

export async function getDeployments(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { namespace } = req.params;
  try {
    const result = await k8sService.getDeployments(namespace || 'default');
    res.status(200).json({ deployments: result.data, execution_mode: result.execution_mode, ...(result.notice ? { notice: result.notice } : {}) });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve deployments.', 500);
  }
}

export async function getServices(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { namespace } = req.params;
  try {
    const result = await k8sService.getServices(namespace || 'default');
    res.status(200).json({ services: result.data, execution_mode: result.execution_mode, ...(result.notice ? { notice: result.notice } : {}) });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve services.', 500);
  }
}

export async function rollbackDeployment(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { namespace, name } = req.body;

  if (!namespace || !name) {
    res.status(400).json({ message: 'Namespace and deployment name are required.' });
    return;
  }

  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  try {
    const result = await k8sService.rollback(namespace, name);

    if (!result.success) {
      res.status(500).json({ message: 'Rollback operation failed.', execution_mode: result.execution_mode, notice: result.notice });
      return;
    }

    // Save rollback deployment record in DB
    await query(
      `INSERT INTO deployments (environment, namespace, deployment_name, image_tag, status, config_yaml)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        namespace === 'default' ? 'dev' : 'staging',
        namespace,
        name,
        'rolled-back-revision',
        'ROLLBACKED',
        `# Deployment manually rolled back in cluster namespace ${namespace}`,
      ]
    );

    // Audit logging (project-scoped when the namespace maps to a single project)
    const projectId = await resolveNamespaceProjectId(namespace);
    await insertAuditLog({
      userId: req.user.id,
      action: 'ROLLBACK',
      resource: 'DEPLOYMENT',
      projectId,
      details: { deploymentName: name, namespace, execution_mode: result.execution_mode },
      req,
    });

    // Emit EventBus event
    await EventBus.emit({
      eventType: 'DEPLOYMENT_ROLLED_BACK',
      source: 'kubernetes',
      severity: 'WARNING',
      resource: name,
      namespace,
      metadata: { user: req.user.email },
    });

    res.status(200).json({
      message: `Deployment ${name} rolled back ${result.execution_mode === 'LIVE' ? 'successfully.' : '(simulated — no live cluster is attached).'}`,
      execution_mode: result.execution_mode,
      ...(result.notice ? { notice: result.notice } : {}),
    });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to execute rollback.', 500);
  }
}

export async function canarySplit(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { namespace, name, weight } = req.body;

  if (!namespace || !name || weight === undefined) {
    res.status(400).json({ message: 'Namespace, deployment name, and weight are required.' });
    return;
  }

  try {
    console.log(
      `[Canary Split] Setting Canary traffic allocation to ${weight}% on deployment "${name}" in namespace "${namespace}"`
    );

    // Save/update canary weight on deployment in DB
    await query(
      `UPDATE deployments SET canary_weight = $1, updated_at = NOW()
       WHERE deployment_name = $2 AND namespace = $3`,
      [weight, name, namespace]
    );

    if (req.user) {
      const projectId = await resolveNamespaceProjectId(namespace);
      await insertAuditLog({
        userId: req.user.id,
        action: 'CANARY_SPLIT',
        resource: 'DEPLOYMENT',
        projectId,
        details: { name, namespace, weight, execution_mode: 'SIMULATED' },
        req,
      });
    }

    await EventBus.emit({
      eventType: 'CANARY_TRAFFIC_SPLIT',
      source: 'kubernetes',
      severity: 'INFO',
      resource: name,
      namespace,
      metadata: { weight, stable_weight: 100 - weight },
    });

    res.status(200).json({
      message: `Canary traffic split of ${weight}% recorded for ${name}.`,
      // DB bookkeeping only — no service mesh/ingress traffic was actually rerouted
      execution_mode: 'SIMULATED',
      notice: 'Canary weight stored in platform records only. No live traffic was rerouted.',
      details: {
        deployment: name,
        namespace,
        traffic_allocation: {
          stable: 100 - weight,
          canary: weight,
        },
        status: 'SYNCED',
        updated_at: new Date(),
      },
    });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to apply canary traffic split.', 500);
  }
}

export async function blueGreenSwap(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { namespace, serviceName, activeColor } = req.body;

  if (!namespace || !serviceName || !activeColor) {
    res.status(400).json({ message: 'Namespace, service name, and activeColor are required.' });
    return;
  }

  try {
    console.log(
      `[Blue-Green Swap] Swapping active router of service "${serviceName}" to "${activeColor}" in namespace "${namespace}"`
    );

    await query(
      `INSERT INTO deployments (environment, namespace, deployment_name, image_tag, status, blue_green_color, config_yaml)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        namespace === 'default' ? 'dev' : 'staging',
        namespace,
        serviceName,
        activeColor === 'green' ? 'v2.0.0-green' : 'v1.0.0-blue',
        'DEPLOYED',
        activeColor,
        `# Blue-Green Router swapped active backend to label color: ${activeColor}`,
      ]
    );

    if (req.user) {
      const projectId = await resolveNamespaceProjectId(namespace);
      await insertAuditLog({
        userId: req.user.id,
        action: 'BLUE_GREEN_SWAP',
        resource: 'SERVICE',
        projectId,
        details: { serviceName, namespace, activeColor, execution_mode: 'SIMULATED' },
        req,
      });
    }

    await EventBus.emit({
      eventType: 'BLUE_GREEN_ROUTER_SWAPPED',
      source: 'kubernetes',
      severity: 'INFO',
      resource: serviceName,
      namespace,
      metadata: { activeColor },
    });

    res.status(200).json({
      message: `Blue-Green active backend recorded as ${activeColor.toUpperCase()}.`,
      // DB bookkeeping only — no live service router was modified
      execution_mode: 'SIMULATED',
      notice: 'Blue-Green swap stored in platform records only. No live router was modified.',
      details: {
        service: serviceName,
        namespace,
        active_color: activeColor,
        standby_color: activeColor === 'blue' ? 'green' : 'blue',
        router_status: 'HEALTHY',
        updated_at: new Date(),
      },
    });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to execute Blue-Green router swap.', 500);
  }
}
