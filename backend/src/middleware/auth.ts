import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import { hashToken } from '../utils/securityUtils';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'deploymate-jwt-secret-key-change-in-production') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is missing or insecure in production mode.');
    }
    return 'deploymate-jwt-secret-key-development-only';
  }
  return secret;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    permissions: any;
    sessionId?: string;
  };
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ message: 'Authentication token required.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string; sessionId?: string };
    const tokenHash = hashToken(token);

    // Query user, role, and active session status
    const userRes = await query(
      `SELECT u.id, u.name, u.email, u.is_active, r.name as role, r.permissions 
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (userRes.rowCount === 0) {
      res.status(401).json({ message: 'User account no longer exists.' });
      return;
    }

    const user = userRes.rows[0];

    if (user.is_active === false) {
      res.status(403).json({ message: 'User account has been disabled by administrator.' });
      return;
    }

    // Stateful session revocation check if user_sessions has session entry
    const sessionRes = await query(
      `SELECT id, revoked_at, expires_at FROM user_sessions WHERE token_hash = $1`,
      [tokenHash]
    );

    if (sessionRes.rowCount && sessionRes.rowCount > 0) {
      const session = sessionRes.rows[0];
      if (session.revoked_at !== null) {
        res.status(401).json({ message: 'Session has been revoked or logged out.' });
        return;
      }
      if (new Date(session.expires_at) < new Date()) {
        res.status(401).json({ message: 'Session expired.' });
        return;
      }
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      sessionId: sessionRes.rows[0]?.id,
    };

    next();
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired token.' });
  }
}

// Role restriction middleware
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized. Authentication required.' });
      return;
    }

    if (req.user.role === 'Super Admin' || allowedRoles.includes(req.user.role)) {
      next();
      return;
    }

    res.status(403).json({
      message: `Forbidden. Role '${req.user.role}' is not authorized for this resource. Required role: ${allowedRoles.join(' or ')}.`,
    });
  };
}

// Granular permission check middleware
export function checkPermission(permissionName: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized. User authentication required.' });
      return;
    }

    const permissions = req.user.permissions;

    // Super Admins have full access
    if (req.user.role === 'Super Admin' || (permissions && permissions.all === true)) {
      next();
      return;
    }

    // Split permission into category and action (e.g. 'pipeline.execute' -> category 'pipeline', action 'execute')
    const [category, action] = permissionName.split('.');

    if (permissions && permissions[category]) {
      const categoryPerms = permissions[category];
      if (categoryPerms === true) {
        next();
        return;
      }
      if (Array.isArray(categoryPerms) && (categoryPerms.includes(action) || categoryPerms.includes('all') || categoryPerms.includes('manage'))) {
        next();
        return;
      }
    }

    res.status(403).json({
      message: `Forbidden. You lack explicit permission '${permissionName}' required for this operational route.`,
    });
  };
}

// IDOR Resource Authorization Helper for Projects
export async function requireProjectAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  // Super Admin can access all projects
  if (req.user.role === 'Super Admin') {
    next();
    return;
  }

  let projectId =
    req.params.projectId ||
    req.body.projectId ||
    (req.query.projectId as string) ||
    req.params.id;

  try {
    // Resolve child resource parameters to parent projectId
    if (!projectId && req.params.pipelineId) {
      const pRes = await query('SELECT project_id FROM pipelines WHERE id = $1', [req.params.pipelineId]);
      if (pRes.rowCount && pRes.rowCount > 0) projectId = pRes.rows[0].project_id;
      else { res.status(404).json({ message: 'Pipeline not found.' }); return; }
    }

    if (!projectId && (req.params.runId || req.params.pipelineRunId || req.query.runId)) {
      const runId = req.params.runId || req.params.pipelineRunId || (req.query.runId as string);
      const prRes = await query(
        'SELECT p.project_id FROM pipeline_runs pr JOIN pipelines p ON pr.pipeline_id = p.id WHERE pr.id = $1',
        [runId]
      );
      if (prRes.rowCount && prRes.rowCount > 0) projectId = prRes.rows[0].project_id;
      else { res.status(404).json({ message: 'Pipeline run not found.' }); return; }
    }

    if (!projectId && req.params.deploymentId) {
      const dRes = await query('SELECT project_id FROM deployments WHERE id = $1', [req.params.deploymentId]);
      if (dRes.rowCount && dRes.rowCount > 0) projectId = dRes.rows[0].project_id;
      else { res.status(404).json({ message: 'Deployment not found.' }); return; }
    }

    if (!projectId && (req.params.stateId || req.body.id || req.body.stateId)) {
      const stateId = req.params.stateId || req.body.id || req.body.stateId;
      const sRes = await query('SELECT project_id FROM terraform_states WHERE id = $1', [stateId]);
      if (sRes.rowCount && sRes.rowCount > 0) projectId = sRes.rows[0].project_id;
      else { res.status(404).json({ message: 'Terraform state not found.' }); return; }
    }

    if (!projectId && (req.params.incidentId || req.body.incidentId)) {
      const incidentId = req.params.incidentId || req.body.incidentId;
      const iRes = await query('SELECT project_id FROM sre_incidents WHERE id = $1', [incidentId]);
      if (iRes.rowCount && iRes.rowCount > 0 && iRes.rows[0].project_id) projectId = iRes.rows[0].project_id;
    }

    if (!projectId && (req.params.chaosId || req.body.chaosId)) {
      const chaosId = req.params.chaosId || req.body.chaosId;
      const cRes = await query('SELECT project_id FROM chaos_experiments WHERE id = $1', [chaosId]);
      if (cRes.rowCount && cRes.rowCount > 0 && cRes.rows[0].project_id) projectId = cRes.rows[0].project_id;
    }

    if (!projectId && (req.params.gitopsId || req.body.gitopsId || req.params.appName)) {
      const gitopsId = req.params.gitopsId || req.body.gitopsId || req.params.appName;
      const gRes = await query(
        'SELECT DISTINCT project_id FROM gitops_sync_history WHERE id = $1 OR app_name = $1',
        [gitopsId]
      );
      if (gRes.rowCount === 1) projectId = gRes.rows[0].project_id;
    }

    if (!projectId && req.params.scanId) {
      const scanRes = await query(
        'SELECT p.project_id FROM pipeline_security_scans pss JOIN pipeline_runs pr ON pss.pipeline_run_id = pr.id JOIN pipelines p ON pr.pipeline_id = p.id WHERE pss.id = $1',
        [req.params.scanId]
      );
      if (scanRes.rowCount && scanRes.rowCount > 0) projectId = scanRes.rows[0].project_id;
      else { res.status(404).json({ message: 'Security scan not found.' }); return; }
    }

    if (!projectId && (req.params.namespace || req.query.namespace)) {
      const ns = req.params.namespace || (req.query.namespace as string);
      const nsRes = await query('SELECT DISTINCT project_id FROM deployments WHERE namespace = $1', [ns]);
      if (nsRes.rowCount === 1) projectId = nsRes.rows[0].project_id;
    }

    if (!projectId) {
      res.status(403).json({ message: 'Forbidden. Project context is required for this operation.' });
      return;
    }

    // Check project existence & ownership
    const projRes = await query('SELECT id, owner_id FROM projects WHERE id = $1', [projectId]);
    if (projRes.rowCount === 0) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    const project = projRes.rows[0];
    if (project.owner_id === req.user.id) {
      next();
      return;
    }

    // Check membership in project_members table
    const memberRes = await query(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (memberRes.rowCount && memberRes.rowCount > 0) {
      next();
      return;
    }

    res.status(403).json({ message: 'Forbidden. You do not have authorization to access this project resource.' });
  } catch {
    res.status(404).json({ message: 'Project not found.' });
  }
}

// Legacy helper compatibility
export function authorize(resource: string, action?: string) {
  return checkPermission(action ? `${resource}.${action}` : `${resource}.read`);
}
