import { Request } from 'express';
import { query } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { isValidUuid } from '../utils/securityUtils';

/**
 * Central audit logging helper.
 *
 * Isolation model (hardening spec §2):
 *  - project_id NOT NULL → project-scoped event, visible to Super Admins and to
 *    users who own or member that project.
 *  - project_id NULL + user_id NOT NULL → personal system event (login, logout,
 *    password reset...), visible to Super Admins and to the subject user only.
 *  - project_id NULL + user_id NULL → global system event (webhook deliveries),
 *    visible to Super Admins only.
 */
export interface AuditEntry {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: Record<string, unknown> | unknown;
  projectId?: string | null;
  req?: Request;
}

export async function insertAuditLog(entry: AuditEntry): Promise<void> {
  const ip = entry.req?.ip || entry.req?.socket?.remoteAddress || null;
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, resource, resource_id, project_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.userId ?? null,
        entry.action,
        entry.resource,
        isValidUuid(entry.resourceId) ? entry.resourceId : null,
        isValidUuid(entry.projectId) ? entry.projectId : null,
        JSON.stringify(entry.details ?? {}),
        ip,
      ]
    );
  } catch (err) {
    // Audit writes must never break the operated request, but failures are loud.
    console.error('[AUDIT] Failed to persist audit log:', (err as Error).message);
  }
}

/**
 * Tenant-isolated audit log query.
 * Super Admin: global visibility. Normal user: only project-scoped rows for
 * projects they own/belong to, plus their own personal system events.
 */
export async function queryAuditLogs(user: AuthenticatedRequest['user'], limit: number): Promise<any[]> {
  if (!user) {
    return [];
  }

  if (user.role === 'Super Admin') {
    const res = await query(
      `SELECT a.id, a.action, a.resource, a.resource_id, a.project_id, a.details, a.ip_address, a.created_at,
              u.name as user_name, u.email as user_email
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  }

  const res = await query(
    `SELECT a.id, a.action, a.resource, a.resource_id, a.project_id, a.details, a.ip_address, a.created_at,
            u.name as user_name, u.email as user_email
     FROM audit_logs a
     LEFT JOIN users u ON a.user_id = u.id
     WHERE
       -- project-scoped events within the caller's projects
       (a.project_id IN (
          SELECT p.id FROM projects p WHERE p.owner_id = $2
          UNION
          SELECT pm.project_id FROM project_members pm WHERE pm.user_id = $2
       )
       OR
       -- personal system events with no project belong to their subject user only
       (a.project_id IS NULL AND a.user_id = $2))
     ORDER BY a.created_at DESC
     LIMIT $1`,
    [limit, user.id]
  );
  return res.rows;
}
