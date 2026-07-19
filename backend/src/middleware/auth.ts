import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'deploymate-jwt-super-secret-key-123456';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    permissions: any;
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
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    // Query user and their role permissions
    const userRes = await query(
      `SELECT u.id, u.name, u.email, r.name as role, r.permissions 
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (userRes.rowCount === 0) {
      res.status(401).json({ message: 'User no longer exists.' });
      return;
    }

    const user = userRes.rows[0];
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    };

    next();
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired token.', error });
  }
}

// Middleware helper to check role permissions
export function authorize(resource: string, action?: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized. User authentication required.' });
      return;
    }

    const permissions = req.user.permissions;

    // Super Admins have bypass permission
    if (permissions && permissions.all === true) {
      next();
      return;
    }

    // Check specific resource permission
    if (permissions && permissions[resource]) {
      const resPerms = permissions[resource];

      // If resource permission is boolean true, allow it
      if (resPerms === true) {
        next();
        return;
      }

      // If resource permission is an array, check if action is included
      if (Array.isArray(resPerms) && action && resPerms.includes(action)) {
        next();
        return;
      }
    }

    res.status(403).json({
      message: `Forbidden. You do not have permission to perform this action (${action || 'read'} on ${resource}).`,
    });
  };
}
