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

const router = Router();
router.use('/shop', shopRouter);

// ============================================================================
// PUBLIC SYSTEM HEALTH CHECK (For load balancer / monitoring)
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
// SYSTEM STATUS ROUTE (ADMIN ONLY - HTTP 403 for others)
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
// AUTHENTICATION ROUTES
// ============================================================================
router.post('/auth/register', (req, res, next) => authController.register(req, res, next));
router.post('/auth/login', (req, res, next) => authController.login(req, res, next));
router.post('/auth/logout', authenticate, (req, res, next) => authController.logout(req, res, next));
router.get('/auth/me', authenticate, (req, res, next) => authController.me(req, res, next));
router.put('/auth/change-password', authenticate, (req, res, next) => authController.changePassword(req, res, next));

// ============================================================================
// USER MANAGEMENT ROUTES (ADMIN ONLY - HTTP 403 for others)
// ============================================================================
router.get('/users', authenticate, authorize('ADMIN'), (req, res, next) => userController.getAll(req, res, next));
router.post('/users', authenticate, authorize('ADMIN'), (req, res, next) => userController.create(req, res, next));
router.put('/users/:id', authenticate, authorize('ADMIN'), (req, res, next) => userController.update(req, res, next));
router.delete('/users/:id', authenticate, authorize('ADMIN'), (req, res, next) => userController.delete(req, res, next));
router.patch('/users/:id/role', authenticate, authorize('ADMIN'), (req, res, next) => userController.changeRole(req, res, next));
router.patch('/users/:id/status', authenticate, authorize('ADMIN'), (req, res, next) => userController.changeStatus(req, res, next));

// ============================================================================
// AUDIT LOG ROUTES
// Read: ADMIN, OPERATOR, USER
// Write / TTL: ADMIN, OPERATOR
// ============================================================================
router.get('/logs', authenticate, authorize('ADMIN', 'USER'), (req, res, next) =>
  auditLogController.getLogs(req, res, next)
);
router.get('/logs/detail', authenticate, authorize('ADMIN', 'USER'), (req, res, next) =>
  auditLogController.getLogDetail(req, res, next)
);
router.get('/logs/stats/summary', authenticate, authorize('ADMIN', 'USER'), (req, res, next) =>
  auditLogController.getStatsSummary(req, res, next)
);
router.get('/logs/:id', authenticate, authorize('ADMIN', 'USER'), (req, res, next) =>
  auditLogController.getLogById(req, res, next)
);

// Ingestion and TTL Logs
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
// SERVICE CATALOG MANAGEMENT ROUTES
// Read: ADMIN, OPERATOR (USER cannot access Services)
// Mutate: ADMIN ONLY
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
// DEMO OPERATIONS ROUTES (AUTO AUDIT LOG GENERATION)
// Personal scenarios: ADMIN/USER. Bulk data and the original admin scenarios: ADMIN.
// ============================================================================
// Auth Demo
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

// User Demo
router.post('/demo/users', authenticate, authorize('ADMIN'), (req, res, next) =>
  demoController.createUser(req, res, next)
);
router.put('/demo/users/:id', authenticate, authorize('ADMIN'), (req, res, next) =>
  demoController.updateUser(req, res, next)
);
router.delete('/demo/users/:id', authenticate, authorize('ADMIN'), (req, res, next) =>
  demoController.deleteUser(req, res, next)
);

// Order Demo
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

// Payment Demo
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
