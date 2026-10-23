import type { Request } from 'express';
import type { AuditLogInput } from '../services/auditLogService.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export function mutationAudit(req: Request, service: string, action: string,
  details: Record<string, unknown> = {}, level: 'INFO' | 'WARN' = 'INFO'): AuditLogInput {
  const actor = (req as AuthenticatedRequest).user?.username || 'system';
  return { service_name: service, action, level,
    message: `${actor} performed ${action}`, user_id: actor,
    ip_address: req.ip || '127.0.0.1', details };
}
