/**
 * [BAREM 2, 3, 4] Bản đồ endpoint và quyền truy cập trước khi xử lý nghiệp vụ.
 * Nhóm /logs phục vụ ghi/lọc/TTL; /services phục vụ CRUD; /health và /system/status kiểm tra kết nối.
 * Chỉ ADMIN được đọc nhật ký; thao tác của USER vẫn ghi audit qua các chức năng nghiệp vụ.
 */
import { Router, Request, Response } from 'express';
import { auditLogController } from '../controllers/auditLogController.js';
import { serviceController } from '../controllers/serviceController.js';
import { demoController } from '../controllers/demoController.js';
import { authController } from '../controllers/authController.js';
import { userController } from '../controllers/userController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { isCassandraHealthy } from '../config/cassandra.js';
import { env } from '../config/env.js';
import { prepareTodayDemoData } from '../services/demoDataService.js';
import shopRouter from './shop.js';
import { cqlConsoleService } from '../services/cqlConsoleService.js';
import { z } from 'zod';

const router = Router();
router.use('/shop', shopRouter);

// [BAREM 1, 3, 4] Console đọc Cassandra thật dành riêng ADMIN, kể cả gọi API trực tiếp.
router.post('/admin/cql', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { query } = z.object({ query: z.string().trim().min(1).max(8000) }).strict().parse(req.body);
    res.json({ success: true, data: await cqlConsoleService.execute(query) });
  } catch (error) { next(error); }
});

// ============================================================================
// [BAREM 4] Kiểm tra API và Cassandra thật; không yêu cầu đăng nhập.
// ============================================================================
router.get('/health', async (req: Request, res: Response) => {
  const dbHealth = await isCassandraHealthy();
  if (dbHealth.healthy) {
    res.status(200).json({
      success: true,
      status: 'UP',
      service: 'Audit Log Backend API',
      cassandra: dbHealth.details,
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      success: false,
      status: 'DEGRADED',
      message: 'Database temporarily unavailable',
      error: dbHealth.error,
    });
  }
});

// ============================================================================
// [BAREM 4] Trạng thái hệ thống dành cho ADMIN; USER gọi trực tiếp nhận 403.
// ============================================================================
router.get(
  '/system/status',
  authenticate,
  authorize('ADMIN'),
  async (req: Request, res: Response) => {
    const dbHealth = await isCassandraHealthy();
    res.status(dbHealth.healthy ? 200 : 503).json({
      success: dbHealth.healthy,
      cassandra: {
        connected: dbHealth.healthy,
        contactPoints: env.CASSANDRA_CONTACT_POINTS,
        port: env.CASSANDRA_PORT,
        keyspace: env.CASSANDRA_KEYSPACE,
        datacenter: env.CASSANDRA_LOCAL_DATA_CENTER,
        details: dbHealth.details || null,
        error: dbHealth.error || null,
      },
      systemInfo: {
        uptime_seconds: process.uptime(),
        node_version: process.version,
        memory_usage: process.memoryUsage(),
        nodetool_help: env.CASSANDRA_NODETOOL_HELP,
      },
    });
  }
);

// ============================================================================
// Xác thực, thông tin phiên, đăng xuất và đổi mật khẩu.
// ============================================================================
router.post('/auth/register', (req, res, next) => authController.register(req, res, next));
router.post('/auth/login', (req, res, next) => authController.login(req, res, next));
router.post('/auth/logout', authenticate, (req, res, next) => authController.logout(req, res, next));
router.get('/auth/me', authenticate, (req, res, next) => authController.me(req, res, next));
router.put('/auth/change-password', authenticate, (req, res, next) => authController.changePassword(req, res, next));

// ============================================================================
// Quản lý tài khoản chỉ dành cho ADMIN.
// ============================================================================
router.get('/users', authenticate, authorize('ADMIN'), (req, res, next) => userController.getAll(req, res, next));
router.post('/users', authenticate, authorize('ADMIN'), (req, res, next) => userController.create(req, res, next));
router.put('/users/:id', authenticate, authorize('ADMIN'), (req, res, next) => userController.update(req, res, next));
router.delete('/users/:id', authenticate, authorize('ADMIN'), (req, res, next) => userController.delete(req, res, next));
router.patch('/users/:id/role', authenticate, authorize('ADMIN'), (req, res, next) => userController.changeRole(req, res, next));
router.patch('/users/:id/status', authenticate, authorize('ADMIN'), (req, res, next) => userController.changeStatus(req, res, next));

// ============================================================================
// [BAREM 2, 3] Các API Audit Log.
// Đọc, thống kê, ghi thủ công và TTL: chỉ ADMIN, kể cả khi gọi API trực tiếp.
// ============================================================================
router.get('/logs', authenticate, authorize('ADMIN'), (req, res, next) =>
  auditLogController.getLogs(req, res, next)
);
router.get('/logs/detail', authenticate, authorize('ADMIN'), (req, res, next) =>
  auditLogController.getLogDetail(req, res, next)
);
router.get('/logs/stats/summary', authenticate, authorize('ADMIN'), (req, res, next) =>
  auditLogController.getStatsSummary(req, res, next)
);
router.get('/logs/:id', authenticate, authorize('ADMIN'), (req, res, next) =>
  auditLogController.getLogById(req, res, next)
);

// [BAREM 2, 3] Tiếp nhận log và trình diễn TTL tự hết hạn.
router.post('/logs', authenticate, authorize('ADMIN'), (req, res, next) =>
  auditLogController.createLog(req, res, next)
);
router.post('/logs/ttl-demo', authenticate, authorize('ADMIN'), (req, res, next) =>
  auditLogController.createTtlDemoLog(req, res, next)
);
router.get('/logs/ttl-status/:id', authenticate, authorize('ADMIN'), (req, res, next) =>
  auditLogController.getTtlStatus(req, res, next)
);

// ============================================================================
// [BAREM 2] Danh mục dịch vụ: cả đọc và thay đổi đều yêu cầu ADMIN.
// ============================================================================
router.get('/services', authenticate, authorize('ADMIN'), (req, res, next) =>
  serviceController.getAll(req, res, next)
);
router.get('/services/:id', authenticate, authorize('ADMIN'), (req, res, next) =>
  serviceController.getById(req, res, next)
);
router.post('/services', authenticate, authorize('ADMIN'), (req, res, next) =>
  serviceController.create(req, res, next)
);
router.put('/services/:id', authenticate, authorize('ADMIN'), (req, res, next) =>
  serviceController.update(req, res, next)
);
router.delete('/services/:id', authenticate, authorize('ADMIN'), (req, res, next) =>
  serviceController.delete(req, res, next)
);

// ============================================================================
// [BAREM 4] Kịch bản phát sinh audit để trình diễn.
// Kịch bản cá nhân: ADMIN/USER; chuẩn bị dữ liệu và kịch bản quản trị cũ: ADMIN.
// ============================================================================
// Sự kiện minh họa nhóm Auth.
router.post('/demo/my-actions', authenticate, authorize('ADMIN', 'USER'), (req, res, next) =>
  demoController.myAction(req, res, next)
);
router.post('/demo/prepare-today', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try { res.json({ success: true, data: await prepareTodayDemoData() }); } catch (error) { next(error); }
});
router.post('/demo/auth/login-success', authenticate, authorize('ADMIN'), (req, res, next) =>
  demoController.loginSuccess(req, res, next)
);
router.post('/demo/auth/login-failed', authenticate, authorize('ADMIN'), (req, res, next) =>
  demoController.loginFailed(req, res, next)
);
router.post('/demo/auth/logout', authenticate, authorize('ADMIN'), (req, res, next) =>
  demoController.logout(req, res, next)
);

// Sự kiện minh họa nhóm User.
router.post('/demo/users', authenticate, authorize('ADMIN'), (req, res, next) =>
  demoController.createUser(req, res, next)
);
router.put('/demo/users/:id', authenticate, authorize('ADMIN'), (req, res, next) =>
  demoController.updateUser(req, res, next)
);
router.delete('/demo/users/:id', authenticate, authorize('ADMIN'), (req, res, next) =>
  demoController.deleteUser(req, res, next)
);

// Sự kiện minh họa nhóm Order; không phải CRUD bảng đơn hàng.
router.post('/demo/orders', authenticate, authorize('ADMIN'), (req, res, next) =>
  demoController.createOrder(req, res, next)
);
router.put('/demo/orders/:id', authenticate, authorize('ADMIN'), (req, res, next) =>
  demoController.updateOrder(req, res, next)
);
router.put('/demo/orders/:id/cancel', authenticate, authorize('ADMIN'), (req, res, next) =>
  demoController.cancelOrder(req, res, next)
);
router.delete('/demo/orders/:id', authenticate, authorize('ADMIN'), (req, res, next) =>
  demoController.deleteOrder(req, res, next)
);

// Sự kiện minh họa nhóm Payment; không xử lý thanh toán thật.
router.post('/demo/payments/success', authenticate, authorize('ADMIN'), (req, res, next) =>
  demoController.paymentSuccess(req, res, next)
);
router.post('/demo/payments/failed', authenticate, authorize('ADMIN'), (req, res, next) =>
  demoController.paymentFailed(req, res, next)
);
router.post('/demo/payments/refund', authenticate, authorize('ADMIN'), (req, res, next) =>
  demoController.paymentRefund(req, res, next)
);

export default router;
