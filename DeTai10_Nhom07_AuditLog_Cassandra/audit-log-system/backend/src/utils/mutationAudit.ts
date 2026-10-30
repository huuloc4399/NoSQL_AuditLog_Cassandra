/**
 * [BAREM 2, 4] Tạo thông tin audit cho thao tác quản trị.
 * Actor lấy từ phiên đã xác thực, không lấy tên người thao tác do client tự khai.
 * Hàm chỉ dựng dữ liệu; service nghiệp vụ mới thực hiện mutation và ghi audit trong batch.
 */
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
