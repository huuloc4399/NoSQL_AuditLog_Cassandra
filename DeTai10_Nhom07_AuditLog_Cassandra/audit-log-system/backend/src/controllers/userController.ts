import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { userService, UserRole, UserStatus } from '../services/userService.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { mutationAudit } from '../utils/mutationAudit.js';
import { AppError } from '../middleware/errorHandler.js';

const profileSchema = z.object({
  full_name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email().max(254).optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'Provide a name or email');

// Preserve validation errors, while database/batch failures reach the 503/500 handler.
function forwardUserError(error: unknown, next: NextFunction): void {
  if (error instanceof Error && error.name === 'Error') {
    next(new AppError(error.message, error.message.includes('already exists') ? 409 : 400));
  } else next(error);
}

export class UserController {
  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try { const users = await userService.getAllUsers(); res.json({ success: true, data: users, count: users.length }); }
    catch (error) { next(error); }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password, full_name, email, role, status } = req.body;
      if (!username || !password) throw new AppError('Username and password are required', 400);
      if (role && !['ADMIN', 'USER'].includes(role)) throw new AppError('Invalid role. Must be ADMIN or USER', 400);
      if (status && !['ACTIVE', 'INACTIVE'].includes(status)) throw new AppError('Invalid account status', 400);
      const created = await userService.createUser({ username, password, full_name, email,
        role: role || 'USER', status: status || 'ACTIVE' },
        mutationAudit(req, 'Auth', 'REGISTER_USER', { role: role || 'USER', status: status || 'ACTIVE' }));
      res.status(201).json({ success: true, message: 'User created successfully', data: created });
    } catch (error) { forwardUserError(error, next); }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const fields = profileSchema.parse(req.body);
      const updated = await userService.updateUser(id, fields,
        mutationAudit(req, 'User', 'UPDATE_USER', { target_user_id: id, changed_fields: Object.keys(fields) }));
      res.json({ success: true, message: 'User profile updated and audit recorded', data: updated });
    } catch (error) { forwardUserError(error, next); }
  }

  async changeRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id); const { role } = req.body;
      if (!['ADMIN', 'USER'].includes(role)) throw new AppError('Invalid role. Must be ADMIN or USER', 400);
      if (req.user?.user_id === id && role !== 'ADMIN') throw new AppError('Cannot revoke your own ADMIN role', 400);
      const target = await userService.findById(id);
      if (!target) throw new AppError('User not found', 404);
      const updated = await userService.changeRole(id, role as UserRole,
        mutationAudit(req, 'Auth', 'CHANGE_USER_ROLE', { target_username: target.username,
          old_role: target.role, new_role: role }, 'WARN'));
      res.json({ success: true, message: `Role changed to ${role}`, data: updated });
    } catch (error) { forwardUserError(error, next); }
  }

  async changeStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id); const { status } = req.body;
      if (!['ACTIVE', 'INACTIVE'].includes(status)) throw new AppError('Invalid account status', 400);
      if (req.user?.user_id === id && status === 'INACTIVE') throw new AppError('Cannot disable your own administrator account', 400);
      const updated = await userService.changeStatus(id, status as UserStatus,
        mutationAudit(req, 'Auth', status === 'INACTIVE' ? 'DISABLE_USER' : 'ENABLE_USER',
          { target_user_id: id, new_status: status }, status === 'INACTIVE' ? 'WARN' : 'INFO'));
      res.json({ success: true, message: `User status set to ${status}`, data: updated });
    } catch (error) { forwardUserError(error, next); }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      if (req.user?.user_id === id) throw new AppError('Cannot delete your own administrator account', 400);
      const target = await userService.findById(id);
      if (!target) throw new AppError('User not found', 404);
      await userService.deleteUser(id, mutationAudit(req, 'Auth', 'DELETE_USER', {
        target_user_id: id, target_username: target.username, deleted_role: target.role }, 'WARN'));
      res.json({ success: true, message: `User '${target.username}' deleted successfully` });
    } catch (error) { forwardUserError(error, next); }
  }
}
export const userController = new UserController();
