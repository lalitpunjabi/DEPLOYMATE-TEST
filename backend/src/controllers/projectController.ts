import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { query } from '../config/db';

export async function listProjects(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // List all projects, joining repository information
    const projectsRes = await query(
      `SELECT p.id, p.name, p.description, p.created_at, p.updated_at,
              r.github_repo_url, r.default_branch, r.webhook_secret
       FROM projects p
       LEFT JOIN repositories r ON r.project_id = p.id
       ORDER BY p.created_at DESC`
    );

    res.status(200).json(projectsRes.rows);
  } catch (error: any) {
    console.error('List projects error:', error);
    res.status(500).json({ message: 'Failed to retrieve projects.', error: error.message });
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
    const webhookSecret = 'whsec_' + Math.random().toString(36).substring(2, 15);

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
      { name: 'Deploy', status: 'PENDING', logs: '' }
    ];

    await query(
      `INSERT INTO pipelines (project_id, name, definition)
       VALUES ($1, $2, $3)`,
      [newProject.id, `${name}-default-pipeline`, JSON.stringify(defaultPipelineDef)]
    );

    await query('COMMIT');

    // Audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, resource, resource_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'CREATE', 'PROJECT', newProject.id, JSON.stringify({ name, repo: github_repo_url, environment })]
    );

    res.status(201).json({
      ...newProject,
      github_repo_url,
      default_branch: default_branch || 'main',
      webhook_secret: webhookSecret,
      environment: environment || 'dev'
    });
  } catch (error: any) {
    await query('ROLLBACK');
    console.error('Create project error:', error);
    res.status(500).json({ message: 'Failed to create project.', error: error.message });
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

    // Audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, resource, resource_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'DELETE', 'PROJECT', id, JSON.stringify({ name: projectName })]
    );

    res.status(200).json({ message: 'Project deleted successfully.' });
  } catch (error: any) {
    console.error('Delete project error:', error);
    res.status(500).json({ message: 'Failed to delete project.', error: error.message });
  }
}

export async function getAuditLogs(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const auditRes = await query(
      `SELECT a.id, a.action, a.resource, a.resource_id, a.details, a.ip_address, a.created_at,
              u.name as user_name, u.email as user_email
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT 100`
    );

    res.status(200).json(auditRes.rows);
  } catch (error: any) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ message: 'Failed to retrieve audit logs.', error: error.message });
  }
}
