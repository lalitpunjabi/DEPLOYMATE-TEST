import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../config/db';
import { AuthenticatedRequest, getJwtSecret } from '../middleware/auth';
import { hashToken, sendSafeError, validatePasswordStrength, isValidUuid } from '../utils/securityUtils';
import { createWsTicket as storeWsTicket, WS_TICKET_TTL_SECONDS } from '../services/wsTicketStore';

export async function createWsTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  // Optional project/terminal association supplied at issue time is validated strictly.
  const { projectId, terminal } = req.body || {};
  let scopedProjectId: string | null = null;

  if (projectId !== undefined && projectId !== null) {
    if (!isValidUuid(projectId)) {
      res.status(400).json({ message: 'Invalid projectId supplied for WebSocket ticket.' });
      return;
    }
    if (req.user.role !== 'Super Admin') {
      const accessRes = await query(
        `SELECT 1 FROM projects p
         WHERE p.id = $1 AND (p.owner_id = $2 OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2))`,
        [projectId, req.user.id]
      );
      if (!accessRes.rowCount) {
        res.status(403).json({ message: 'Forbidden. You do not have authorization for this project.' });
        return;
      }
    } else {
      const existsRes = await query('SELECT 1 FROM projects WHERE id = $1', [projectId]);
      if (!existsRes.rowCount) {
        res.status(404).json({ message: 'Project not found.' });
        return;
      }
    }
    scopedProjectId = projectId;
  }

  const allowsTerminal = terminal === true && (req.user.role === 'Super Admin' || req.user.role === 'DevOps Engineer');

  try {
    const ticket = await storeWsTicket(req.user.id, { projectId: scopedProjectId, allowsTerminal });
    res.status(200).json({ ticket, expires_in: WS_TICKET_TTL_SECONDS });
  } catch (error: any) {
    sendSafeError(res, error, 'Failed to issue WebSocket ticket.');
  }
}

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ message: 'Name, email, and password are required.' });
    return;
  }

  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    res.status(400).json({ message: passwordError });
    return;
  }

  try {
    // Check if user already exists
    const userExist = await query('SELECT 1 FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (userExist.rowCount && userExist.rowCount > 0) {
      res.status(400).json({ message: 'User with this email already exists.' });
      return;
    }

    // ALWAYS enforce 'Developer' role for public self-registration (No privilege escalation allowed!)
    const targetRoleName = 'Developer';
    const roleRes = await query('SELECT id FROM roles WHERE name = $1', [targetRoleName]);
    if (roleRes.rowCount === 0) {
      res.status(500).json({ message: 'Default Developer role configuration error.' });
      return;
    }
    const roleId = roleRes.rows[0].id;

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Save user
    const insertRes = await query(
      `INSERT INTO users (name, email, password_hash, role_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, email, created_at`,
      [name.trim(), email.toLowerCase().trim(), passwordHash, roleId]
    );

    const newUser = insertRes.rows[0];

    // Log audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, resource, details)
       VALUES ($1, $2, $3, $4)`,
      [newUser.id, 'REGISTER', 'USER', JSON.stringify({ email: newUser.email, assignedRole: 'Developer' })]
    );

    res.status(201).json({
      message: 'User registered successfully.',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: targetRoleName,
      },
    });
  } catch (error: any) {
    sendSafeError(res, error, 'Registration failed.');
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required.' });
    return;
  }

  try {
    const cleanEmail = email.toLowerCase().trim();
    // Fetch user and role name
    const userRes = await query(
      `SELECT u.id, u.name, u.email, u.password_hash, u.is_active, r.name as role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = $1`,
      [cleanEmail]
    );

    if (userRes.rowCount === 0) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const user = userRes.rows[0];

    if (user.is_active === false) {
      res.status(403).json({ message: 'User account has been disabled by administrator.' });
      return;
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      // Audit log failed login
      await query(
        `INSERT INTO audit_logs (user_id, action, resource, details)
         VALUES ($1, $2, $3, $4)`,
        [user.id, 'LOGIN_FAILURE', 'USER', JSON.stringify({ email: cleanEmail, reason: 'Invalid password' })]
      );
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    // Generate JWT
    const sessionId = crypto.randomUUID();
    const token = jwt.sign({ userId: user.id, sessionId }, getJwtSecret(), { expiresIn: '8h' });
    const tokenHashStr = hashToken(token);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

    // Save active session in user_sessions
    await query(
      `INSERT INTO user_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, tokenHashStr, req.ip || req.socket.remoteAddress || '', req.headers['user-agent'] || '', expiresAt]
    );

    // Audit log successful login
    await query(
      `INSERT INTO audit_logs (user_id, action, resource, details)
       VALUES ($1, $2, $3, $4)`,
      [user.id, 'LOGIN_SUCCESS', 'USER', JSON.stringify({ email: user.email })]
    );

    res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role_name,
      },
    });
  } catch (error: any) {
    sendSafeError(res, error, 'Login failed.');
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
      const tokenHashStr = hashToken(token);

      // Revoke session in database
      await query(
        `UPDATE user_sessions SET revoked_at = NOW() WHERE token_hash = $1`,
        [tokenHashStr]
      );

      await query(
        `INSERT INTO audit_logs (user_id, action, resource, details)
         VALUES ($1, $2, $3, $4)`,
        [decoded.userId, 'LOGOUT', 'USER', '{}']
      );
    } catch {
      // Ignore token verification errors on logout
    }
  }

  res.status(200).json({ message: 'Logout successful.' });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ message: 'Email is required.' });
    return;
  }

  // Uniform response message to prevent email enumeration
  const genericResponse = {
    message: 'If an account with that email exists, a password reset request has been processed.',
  };

  try {
    const cleanEmail = email.toLowerCase().trim();
    const userRes = await query('SELECT id FROM users WHERE email = $1', [cleanEmail]);

    if (userRes.rowCount === 0) {
      res.status(200).json(genericResponse);
      return;
    }

    const userId = userRes.rows[0].id;
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const tokenHashStr = hashToken(rawResetToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHashStr, expiresAt]
    );

    await query(
      `INSERT INTO audit_logs (user_id, action, resource, details)
       VALUES ($1, $2, $3, $4)`,
      [userId, 'PASSWORD_RESET_REQUEST', 'USER', JSON.stringify({ email: cleanEmail })]
    );

    // In production without SMTP configured, include token in non-production response only for dev testing
    const responseData: any = { ...genericResponse };
    if (process.env.NODE_ENV !== 'production') {
      responseData.dev_reset_token = rawResetToken;
    }

    res.status(200).json(responseData);
  } catch (error: any) {
    sendSafeError(res, error, 'Password reset request failed.');
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    res.status(400).json({ message: 'Token and new password are required.' });
    return;
  }

  const newPasswordError = validatePasswordStrength(newPassword);
  if (newPasswordError) {
    res.status(400).json({ message: newPasswordError });
    return;
  }

  try {
    const tokenHashStr = hashToken(token);
    const tokenRes = await query(
      `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = $1`,
      [tokenHashStr]
    );

    if (tokenRes.rowCount === 0) {
      res.status(400).json({ message: 'Invalid or expired password reset token.' });
      return;
    }

    const resetTokenObj = tokenRes.rows[0];

    if (resetTokenObj.used_at !== null) {
      res.status(400).json({ message: 'This reset token has already been used.' });
      return;
    }

    if (new Date(resetTokenObj.expires_at) < new Date()) {
      res.status(400).json({ message: 'Password reset token has expired.' });
      return;
    }

    const userId = resetTokenObj.user_id;
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      passwordHash,
      userId,
    ]);

    // Mark reset token as used
    await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [resetTokenObj.id]);

    // Revoke all active sessions for this user after password reset
    await query('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);

    // Audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, resource, details)
       VALUES ($1, $2, $3, $4)`,
      [userId, 'PASSWORD_RESET_SUCCESS', 'USER', '{}']
    );

    res.status(200).json({ message: 'Password reset successful. Please log in with your new password.' });
  } catch (error: any) {
    sendSafeError(res, error, 'Password reset failed.');
  }
}
