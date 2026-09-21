import crypto from 'crypto';
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { query } from '../config/db';
import { sendSafeError } from '../utils/securityUtils';
import { insertAuditLog, queryAuditLogs } from '../services/auditService';

export async function listProjects(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  try {
    let projectsRes;
    if (req.user.role === 'Super Admin') {
      projectsRes = await query(
        `SELECT p.id, p.name, p.description, p.created_at, p.updated_at,
                r.github_repo_url, r.default_branch, (r.webhook_secret IS NOT NULL) AS webhook_configured
         FROM projects p
         LEFT JOIN repositories r ON r.project_id = p.id
         ORDER BY p.created_at DESC`
      );
    } else {
      projectsRes = await query(
        `SELECT p.id, p.name, p.description, p.created_at, p.updated_at,
                r.github_repo_url, r.default_branch, (r.webhook_secret IS NOT NULL) AS webhook_configured
         FROM projects p
         LEFT JOIN repositories r ON r.project_id = p.id
         WHERE p.owner_id = $1 OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $1)
         ORDER BY p.created_at DESC`,
        [req.user.id]
      );
    }

    res.status(200).json(projectsRes.rows);
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve projects.', 500);
  }
}

export async function createProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { name, description, github_repo_url, default_branch, environment } = req.body;

  if (!name || !github_repo_url) {
    res.status(400).json({ message: 'Project name and GitHub Repository URL are required.' });
    return;
  }

  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  try {
    // Start transactional creation of project and repo registry
    await query('BEGIN');

    const projectInsertRes = await query(
      `INSERT INTO projects (name, description, owner_id) 
       VALUES ($1, $2, $3) 
       RETURNING id, name, description, created_at`,
      [name, description, req.user.id]
    );

    const newProject = projectInsertRes.rows[0];
    const webhookSecret = 'whsec_' + crypto.randomBytes(24).toString('hex');

    await query(
      `INSERT INTO repositories (project_id, github_repo_url, default_branch, webhook_secret) 
       VALUES ($1, $2, $3, $4)`,
      [newProject.id, github_repo_url, default_branch || 'main', webhookSecret]
    );

    // Create a default pipeline definition for new project
    const defaultPipelineDef = [
      { name: 'Source', status: 'PENDING', logs: '' },
      { name: 'Build', status: 'PENDING', logs: '' },
      { name: 'Test', status: 'PENDING', logs: '' },
      { name: 'Code Quality', status: 'PENDING', logs: '' },
      { name: 'Security Scan', status: 'PENDING', logs: '' },
      { name: 'Docker Build', status: 'PENDING', logs: '' },
      { name: 'Image Push', status: 'PENDING', logs: '' },
      { name: 'Deploy', status: 'PENDING', logs: '' },
    ];

    await query(
      `INSERT INTO pipelines (project_id, name, definition)
       VALUES ($1, $2, $3)`,
      [newProject.id, `${name}-default-pipeline`, JSON.stringify(defaultPipelineDef)]
    );

    await query('COMMIT');

    // Audit log (project-scoped)
    await insertAuditLog({
      userId: req.user.id,
      action: 'CREATE',
      resource: 'PROJECT',
      resourceId: newProject.id,
      projectId: newProject.id,
      details: { name, repo: github_repo_url, environment },
      req,
    });

    res.status(201).json({
      ...newProject,
      github_repo_url,
      default_branch: default_branch || 'main',
      webhook_configured: true,
      environment: environment || 'dev',
    });
  } catch (error: any) {
    await query('ROLLBACK');
    sendSafeError(res, error, 'Failed to create project.', 500);
  }
}

export async function deleteProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  try {
    const checkRes = await query('SELECT name FROM projects WHERE id = $1', [id]);
    if (checkRes.rowCount === 0) {
      res.status(404).json({ message: 'Project not found.' });
      return;
    }

    const projectName = checkRes.rows[0].name;

    await query('DELETE FROM projects WHERE id = $1', [id]);

    // Audit log. project_id intentionally NOT referenced here: the project row
    // no longer exists (FK ON DELETE), so this stays a personal system event.
    await insertAuditLog({
      userId: req.user.id,
      action: 'DELETE',
      resource: 'PROJECT',
      resourceId: id,
      details: { name: projectName },
      req,
    });

    res.status(200).json({ message: 'Project deleted successfully.' });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to delete project.', 500);
  }
}

export async function getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // Tenant-isolated: Super Admin sees everything; normal users only see rows
    // for their own projects plus their own personal system events.
    const rows = await queryAuditLogs(req.user, 100);
    res.status(200).json(rows);
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to retrieve audit logs.', 500);
  }
}
