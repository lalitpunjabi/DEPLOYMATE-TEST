import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'deploymate-jwt-secret-key-change-in-production';

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

// Legacy helper compatibility
export function authorize(resource: string, action?: string) {
  return checkPermission(action ? `${resource}.${action}` : `${resource}.read`);
}
