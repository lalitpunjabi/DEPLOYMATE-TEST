import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { query } from '../config/db';
import { sendSafeError } from '../utils/securityUtils';

// List all registered users
export async function listUsers(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const usersRes = await query(
      `SELECT u.id, u.name, u.email, u.is_active, u.created_at, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`
    );
    res.status(200).json(usersRes.rows);
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to fetch users.');
  }
}

// Modify role of a specified user
export async function updateUserRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { userId } = req.params;
  const { roleName } = req.body;

  if (!userId || !roleName) {
    res.status(400).json({ message: 'userId and roleName are required.' });
    return;
  }

  // Prevent Super Admin from changing their own role to prevent self-lockout
  if (req.user?.id === userId && roleName !== 'Super Admin') {
    res.status(400).json({ message: 'Safety Constraint: Super Admin cannot demote their own account.' });
    return;
  }

  try {
    const roleRes = await query('SELECT id FROM roles WHERE name = $1', [roleName]);
    if (roleRes.rowCount === 0) {
      res.status(400).json({ message: `Role "${roleName}" does not exist.` });
      return;
    }
    const roleId = roleRes.rows[0].id;

    const updateRes = await query(
      `UPDATE users SET role_id = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name`,
      [roleId, userId]
    );

    if (updateRes.rowCount === 0) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const updatedUser = updateRes.rows[0];

    // Log admin audit action
    await query(
      `INSERT INTO audit_logs (user_id, action, resource, details)
       VALUES ($1, $2, $3, $4)`,
      [
        req.user?.id,
        'ADMIN_ROLE_CHANGED',
        'USER',
        JSON.stringify({ targetUserId: userId, targetEmail: updatedUser.email, newRole: roleName }),
      ]
    );

    res.status(200).json({ message: `User role updated to ${roleName} successfully.` });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to update user role.');
  }
}

// Toggle user active status (disable/enable user)
export async function toggleUserStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { userId } = req.params;
  const { isActive } = req.body;

  if (!userId || typeof isActive !== 'boolean') {
    res.status(400).json({ message: 'userId and boolean isActive status are required.' });
    return;
  }

  if (req.user?.id === userId && isActive === false) {
    res.status(400).json({ message: 'Safety Constraint: Super Admin cannot disable their own account.' });
    return;
  }

  try {
    const updateRes = await query(
      `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email`,
      [isActive, userId]
    );

    if (updateRes.rowCount === 0) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    // If disabling user, revoke all active sessions immediately
    if (isActive === false) {
      await query(`UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, resource, details)
       VALUES ($1, $2, $3, $4)`,
      [
        req.user?.id,
        isActive ? 'ADMIN_USER_ENABLED' : 'ADMIN_USER_DISABLED',
        'USER',
        JSON.stringify({ targetUserId: userId }),
      ]
    );

    res.status(200).json({ message: `User account status updated to ${isActive ? 'ACTIVE' : 'DISABLED'}.` });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to update user status.');
  }
}

// List active user sessions
export async function listActiveSessions(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const sessionsRes = await query(
      `SELECT s.id, s.user_id, u.name as user_name, u.email as user_email, s.ip_address, s.user_agent, s.created_at, s.expires_at, s.revoked_at
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       ORDER BY s.created_at DESC
       LIMIT 100`
    );
    res.status(200).json(sessionsRes.rows);
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to fetch sessions.');
  }
}

// Revoke a specific session or all sessions for a user
export async function revokeSession(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { userId } = req.body;

  try {
    if (sessionId) {
      await query(`UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1`, [sessionId]);
    } else if (userId) {
      await query(`UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
    } else {
      res.status(400).json({ message: 'sessionId or userId is required.' });
      return;
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, resource, details)
       VALUES ($1, $2, $3, $4)`,
      [req.user?.id, 'ADMIN_SESSION_REVOKED', 'USER_SESSION', JSON.stringify({ sessionId, userId })]
    );

    res.status(200).json({ message: 'Session(s) revoked successfully.' });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to revoke session.');
  }
}
