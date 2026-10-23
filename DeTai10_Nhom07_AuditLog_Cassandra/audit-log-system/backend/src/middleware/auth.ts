import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { userService, UserRole } from '../services/userService.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    user_id: string;
    username: string;
    role: UserRole;
    full_name?: string;
    email?: string;
  };
}

/**
 * Middleware: Verify JWT Bearer token and active account status
 * HTTP 401 for missing, invalid, expired tokens or inactive accounts
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized',
      error: 'Missing or malformed Authorization header. Bearer token required.',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      user_id?: string;
      username: string;
      role: UserRole;
    };

    // Verify account is still active in database
    const dbUser = await userService.findByUsername(decoded.username);
    if (!dbUser || dbUser.status !== 'ACTIVE') {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
        error: 'Account is disabled. Please contact system administrator.',
      });
      return;
    }

    req.user = {
      user_id: dbUser.user_id,
      username: decoded.username,
      role: dbUser.role,
      full_name: dbUser?.full_name,
      email: dbUser?.email,
    };

    next();
  } catch (error: any) {
    if (!['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(error.name)) {
      next(error);
      return;
    }
    res.status(401).json({
      success: false,
      message: 'Unauthorized',
      error: error.name === 'TokenExpiredError' ? 'Token expired. Please re-login.' : 'Invalid authentication token.',
    });
  }
}

/**
 * Middleware Factory: Enforce Role-Based Access Control (RBAC)
 * HTTP 403 Forbidden when authenticated user lacks required role
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
        error: 'Authentication required before role authorization check.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Forbidden',
        error: `Access denied. Role '${req.user.role}' lacks required permissions. Allowed roles: [${allowedRoles.join(
          ', '
        )}]`,
      });
      return;
    }

    next();
  };
}

// Backwards compatibility alias
export const requireAuth = authenticate;
