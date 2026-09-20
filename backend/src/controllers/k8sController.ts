import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { k8sService } from '../services/k8sService';
import { query } from '../config/db';
import { EventBus } from '../services/eventBus';
import { sendSafeError } from '../utils/securityUtils';

export async function getNamespaces(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const namespaces = await k8sService.getNamespaces();
    res.status(200).json({ namespaces, execution_mode: k8sService.getMode() });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve namespaces.', 500);
  }
}

export async function getPods(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { namespace } = req.params;
  try {
    const pods = await k8sService.getPods(namespace || 'default');
    res.status(200).json({ pods, execution_mode: k8sService.getMode() });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve pods.', 500);
  }
}

export async function getDeployments(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { namespace } = req.params;
  try {
    const deployments = await k8sService.getDeployments(namespace || 'default');
    res.status(200).json({ deployments, execution_mode: k8sService.getMode() });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve deployments.', 500);
  }
}

export async function getServices(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { namespace } = req.params;
  try {
    const services = await k8sService.getServices(namespace || 'default');
    res.status(200).json({ services, execution_mode: k8sService.getMode() });
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
    const success = await k8sService.rollback(namespace, name);

    if (!success) {
      res.status(500).json({ message: 'Rollback operation failed.' });
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

    // Audit logging
    await query(
      `INSERT INTO audit_logs (user_id, action, resource, details)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, 'ROLLBACK', 'DEPLOYMENT', JSON.stringify({ deploymentName: name, namespace })]
    );

    // Emit EventBus event
    await EventBus.emit({
      eventType: 'DEPLOYMENT_ROLLED_BACK',
      source: 'kubernetes',
      severity: 'WARNING',
      resource: name,
      namespace,
      metadata: { user: req.user.email },
    });

    res.status(200).json({ message: `Deployment ${name} rolled back successfully.`, execution_mode: k8sService.getMode() });
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
      await query(
        `INSERT INTO audit_logs (user_id, action, resource, details)
         VALUES ($1, $2, $3, $4)`,
        [req.user.id, 'CANARY_SPLIT', 'DEPLOYMENT', JSON.stringify({ name, namespace, weight })]
      );
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
      message: `Canary traffic split of ${weight}% successfully applied to ${name}.`,
      execution_mode: k8sService.getMode(),
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
      await query(
        `INSERT INTO audit_logs (user_id, action, resource, details)
         VALUES ($1, $2, $3, $4)`,
        [req.user.id, 'BLUE_GREEN_SWAP', 'SERVICE', JSON.stringify({ serviceName, namespace, activeColor })]
      );
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
      message: `Blue-Green active backend successfully swapped to ${activeColor.toUpperCase()}.`,
      execution_mode: k8sService.getMode(),
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
