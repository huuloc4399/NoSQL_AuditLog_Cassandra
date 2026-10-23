import { Request, Response, NextFunction } from 'express';
import { auditLogService } from '../services/auditLogService.js';
import { createLogSchema, queryLogSchema, isValidUuid } from '../validators/auditLogValidator.js';
import { AppError } from '../middleware/errorHandler.js';

export class AuditLogController {
  /**
   * POST /api/logs - Create audit log entry manually with validation & multi-table write
   */
  async createLog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-request-id'];
      const rawBody = {
        ...req.body,
        log_id: req.body.log_id || (typeof idempotencyKey === 'string' && isValidUuid(idempotencyKey) ? idempotencyKey : undefined),
      };

      const validatedData = createLogSchema.parse(rawBody);
      const logRecord = await auditLogService.createLog({
        ...validatedData,
        ip_address: validatedData.ip_address || req.ip || '127.0.0.1',
      });

      res.status(201).json({
        success: true,
        message: 'Audit log recorded successfully in Cassandra',
        data: logRecord,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/logs - Query audit logs with Query-First partition routing and cursor pagination
   */
  async getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedQuery = queryLogSchema.parse(req.query);
      const cursor = validatedQuery.cursor || validatedQuery.pageState || validatedQuery.page_state || null;
      const result = await auditLogService.queryLogs({
        ...validatedQuery,
        page_state: cursor,
      });

      const nextCursor = result.page_state || null;
      const hasNext = Boolean(nextCursor);

      res.status(200).json({
        success: true,
        message: 'Audit logs retrieved successfully',
        data: result.logs,
        count: result.count,
        page_state: nextCursor,
        pagination: {
          limit: validatedQuery.limit || 100,
          nextCursor,
          hasNext,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/logs/:id - Point query audit log by UUID (O(1) lookup)
   */
  async getLogById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const logId = String(req.params.id);
      if (!isValidUuid(logId)) {
        throw new AppError(`Invalid UUID format for log_id: '${logId}'`, 400);
      }

      const { service, date, time } = req.query;
      const log = await auditLogService.getLogById(
        logId,
        service ? String(service) : undefined,
        date ? String(date) : undefined,
        time ? String(time) : undefined
      );

      if (!log) {
        throw new AppError(`Audit log with ID '${logId}' not found`, 404);
      }

      res.status(200).json({
        success: true,
        message: 'Audit log retrieved successfully',
        data: log,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/logs/detail - Get specific audit log by composite key (for backwards compatibility)
   */
  async getLogDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { service, date, time, id } = req.query;
      if (!service || !date || !time || !id) {
        throw new AppError('Missing required query parameters: service, date, time, id', 400);
      }

      const logIdStr = String(id);
      if (!isValidUuid(logIdStr)) {
        throw new AppError(`Invalid UUID format for log_id: '${logIdStr}'`, 400);
      }

      const log = await auditLogService.getLogById(
        logIdStr,
        String(service),
        String(date),
        String(time)
      );

      if (!log) {
        throw new AppError('Audit log not found', 404);
      }

      res.status(200).json({
        success: true,
        message: 'Audit log detail retrieved',
        data: log,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/logs/stats/summary - Dashboard summary statistics
   */
  async getStatsSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = req.query.date ? String(req.query.date) : undefined;
      const stats = await auditLogService.getDashboardSummary(date);

      res.status(200).json({
        success: true,
        message: 'Dashboard summary statistics retrieved',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/logs/ttl-demo - Insert a record with TTL = 30 seconds for live demo
   */
  async createTtlDemoLog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ttlSeconds = req.body.ttl ? Number(req.body.ttl) : 30;
      const logRecord = await auditLogService.createLog({
        service_name: 'Auth',
        level: 'WARN',
        action: 'TTL_DEMO',
        message: `TTL Demo Log [${new Date().toLocaleTimeString()}] - Auto-expires in ${ttlSeconds} seconds`,
        user_id: 'ttl_demo_user',
        ip_address: req.ip || '192.168.1.50',
        details: {
          test_type: 'Cassandra Native TTL Demonstration',
          ttl_seconds: ttlSeconds,
          created_at: new Date().toISOString(),
        },
        ttl: ttlSeconds,
      });

      res.status(201).json({
        success: true,
        message: `TTL test log created with ${ttlSeconds}s lifespan in Apache Cassandra`,
        data: logRecord,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/logs/ttl-status/:id - Real-time Cassandra TTL inspection
   */
  async getTtlStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const logId = String(req.params.id);
      const status = await auditLogService.getTtlStatus(logId);

      res.status(200).json({
        success: true,
        found: status.found,
        expired: status.expired,
        remaining_ttl: status.remaining_ttl,
        data: status.log,
        message: status.found
          ? `Record active in Cassandra. TTL(message) = ${status.remaining_ttl}s remaining.`
          : 'Record has expired in Apache Cassandra (0 rows returned).',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const auditLogController = new AuditLogController();
