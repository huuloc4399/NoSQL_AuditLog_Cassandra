import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { userService } from '../services/userService.js';
import { auditLogService } from '../services/auditLogService.js';
import { mutationAudit } from '../utils/mutationAudit.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export class AuthController {
  /**
   * POST /api/auth/register - Register a new user
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password, full_name, email } = req.body;

      const cleanUsername = String(username || '').trim().toLowerCase();
      if (!cleanUsername || cleanUsername.length < 3) {
        res.status(400).json({
          success: false,
          message: 'Username must be at least 3 characters long',
          error: 'Validation error: username must be at least 3 characters long',
        });
        return;
      }

      if (!password || password.length < 8) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long',
          error: 'Validation error: password must be at least 8 characters long',
        });
        return;
      }

      // Email format validation if provided
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
        res.status(400).json({
          success: false,
          message: 'Invalid email address',
          error: 'Validation error: email format is invalid',
        });
        return;
      }

      const existing = await userService.findByUsername(cleanUsername);
      if (existing) {
        res.status(409).json({
          success: false,
          message: 'Username already exists',
          error: `The username '${cleanUsername}' is already registered`,
        });
        return;
      }

      // Self-registration strictly enforces role = USER, ignoring any client role
      const newUser = await userService.createUser({
        username: cleanUsername,
        password,
        full_name: full_name ? String(full_name).trim() : cleanUsername,
        email: email ? String(email).trim().toLowerCase() : `${cleanUsername}@auditlog.internal`,
        role: 'USER',
        status: 'ACTIVE',
      }, { ...mutationAudit(req, 'Auth', 'REGISTER_USER', { role: 'USER' }), user_id: cleanUsername });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: { user: newUser },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/login - User Login (Bcrypt verification + JWT)
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({
          success: false,
          message: 'Username and password are required',
          error: 'Validation error: username and password cannot be blank',
        });
        return;
      }

      const cleanUsername = username.trim().toLowerCase();
      const user = await userService.findByUsername(cleanUsername);

      if (!user) {
        // Audit log failed login
          await auditLogService.createLog({
          internal: true,
            service_name: 'Auth',
            level: 'WARN',
            action: 'LOGIN_FAILED',
            message: `Login failed: Username '${cleanUsername}' does not exist`,
            user_id: cleanUsername,
            ip_address: req.ip || '127.0.0.1',
            details: { reason: 'USER_NOT_FOUND', ip: req.ip || '127.0.0.1' },
          });

        res.status(401).json({
          success: false,
          message: 'Invalid username or password',
          error: 'Authentication failed: credentials do not match',
        });
        return;
      }

      // Check account status
      if (user.status === 'INACTIVE') {
          await auditLogService.createLog({
          internal: true,
            service_name: 'Auth',
            level: 'WARN',
            action: 'LOGIN_FAILED',
            message: `Login rejected: Account for '${user.username}' is disabled`,
            user_id: user.username,
            ip_address: req.ip || '127.0.0.1',
            details: { reason: 'ACCOUNT_DISABLED', role: user.role },
          });

        res.status(401).json({
          success: false,
          message: 'Account disabled',
          error: 'Your account has been deactivated. Please contact an administrator.',
        });
        return;
      }

      // Check password with bcrypt
      const isMatch = bcrypt.compareSync(password, user.password_hash);
      if (!isMatch) {
          await auditLogService.createLog({
          internal: true,
            service_name: 'Auth',
            level: 'WARN',
            action: 'LOGIN_FAILED',
            message: `Login failed: Incorrect password provided for '${user.username}'`,
            user_id: user.username,
            ip_address: req.ip || '127.0.0.1',
            details: { reason: 'WRONG_PASSWORD', role: user.role },
          });

        res.status(401).json({
          success: false,
          message: 'Invalid username or password',
          error: 'Authentication failed: credentials do not match',
        });
        return;
      }

      // Generate JWT Token with 24h expiration
      const token = jwt.sign(
        {
          user_id: user.user_id,
          username: user.username,
          role: user.role,
        },
        env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Audit Log for successful login
        await auditLogService.createLog({
          internal: true,
          service_name: 'Auth',
          level: 'INFO',
          action: 'LOGIN_SUCCESS',
          message: `User '${user.username}' authenticated successfully with role '${user.role}'`,
          user_id: user.username,
          ip_address: req.ip || '127.0.0.1',
          details: { role: user.role, login_type: 'DASHBOARD_PORTAL' },
        });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: userService.toSafeUser(user),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout - Logout user and record audit trail
   */
  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const username = req.user?.username || 'anonymous';
      const role = req.user?.role || 'USER';

        await auditLogService.createLog({
          internal: true,
          service_name: 'Auth',
          level: 'INFO',
          action: 'LOGOUT',
          message: `User '${username}' logged out of the session`,
          user_id: username,
          ip_address: req.ip || '127.0.0.1',
          details: { role, session_closed: true },
        });

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me - Return authenticated user session info
   */
  async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Not authenticated',
          error: 'Session missing or invalid',
        });
        return;
      }

      const user = await userService.findByUsername(req.user.username);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Current session active',
        data: {
          user: userService.toSafeUser(user),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/auth/change-password - Change current user's password
   */
  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Not authenticated',
        });
        return;
      }

      const { old_password, new_password } = req.body;

      if (!old_password || !new_password) {
        res.status(400).json({
          success: false,
          message: 'Old and new passwords are required',
          error: 'Validation error: missing required password fields',
        });
        return;
      }

      await userService.changePassword(req.user.user_id, old_password, new_password,
        mutationAudit(req, 'Auth', 'CHANGE_PASSWORD', { target_user_id: req.user.user_id }));

      res.status(200).json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error: any) {
      if (error.name === 'Error') res.status(400).json({ success: false, message: error.message });
      else next(error);
    }
  }
}

export const authController = new AuthController();
