import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';

const getJwtSecret = () => process.env.JWT_SECRET || 'deploymate-jwt-secret-key-change-in-production';

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password, roleName } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ message: 'Name, email, and password are required.' });
    return;
  }

  try {
    // Check if user already exists
    const userExist = await query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (userExist.rowCount && userExist.rowCount > 0) {
      res.status(400).json({ message: 'User with this email already exists.' });
      return;
    }

    // Default to Developer if no role specified or is an invalid role
    const targetRoleName = roleName || 'Developer';
    const roleRes = await query('SELECT id FROM roles WHERE name = $1', [targetRoleName]);
    if (roleRes.rowCount === 0) {
      res.status(400).json({ message: `Role "${targetRoleName}" not found.` });
      return;
    }
    const roleId = roleRes.rows[0].id;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Save user
    const insertRes = await query(
      `INSERT INTO users (name, email, password_hash, role_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, email, created_at`,
      [name, email, passwordHash, roleId]
    );

    const newUser = insertRes.rows[0];

    // Log audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, resource, details)
       VALUES ($1, $2, $3, $4)`,
      [newUser.id, 'REGISTER', 'USER', JSON.stringify({ email: newUser.email })]
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
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error.', error: error.message });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required.' });
    return;
  }

  try {
    // Fetch user and role name
    const userRes = await query(
      `SELECT u.id, u.name, u.email, u.password_hash, r.name as role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = $1`,
      [email]
    );

    if (userRes.rowCount === 0) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const user = userRes.rows[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    // Generate JWT
    const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '24h' });

    // Log audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, resource, details)
       VALUES ($1, $2, $3, $4)`,
      [user.id, 'LOGIN', 'USER', JSON.stringify({ email: user.email })]
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
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error.', error: error.message });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  // Since JWT is stateless, logout is handled by client disposing the token.
  // We return a simple confirmation and log audit log if request was authenticated.
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
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

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    res.status(400).json({ message: 'Email and new password are required.' });
    return;
  }

  try {
    const userRes = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rowCount === 0) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    const userId = userRes.rows[0].id;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      passwordHash,
      userId,
    ]);

    // Log audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, resource, details)
       VALUES ($1, $2, $3, $4)`,
      [userId, 'PASSWORD_RESET', 'USER', JSON.stringify({ email })]
    );

    res.status(200).json({ message: 'Password reset successful.' });
  } catch (error: any) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Internal server error.', error: error.message });
  }
}
