import { Request, Response, NextFunction } from 'express';
import { auditLogService } from '../services/auditLogService.js';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.js';

const personalScenario = z.object({ scenario: z.enum([
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'UPDATE_USER',
  'CREATE_ORDER', 'UPDATE_ORDER', 'CANCEL_ORDER', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED',
]) }).strict();

export class DemoController {
  async myAction(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { scenario } = personalScenario.parse(req.body);
      const actor = req.user!;
      const service = scenario.startsWith('PAYMENT') ? 'Payment'
        : scenario.includes('ORDER') ? 'Order' : scenario === 'UPDATE_USER' ? 'User' : 'Auth';
      const level = scenario === 'PAYMENT_FAILED' ? 'ERROR'
        : ['LOGIN_FAILED', 'CANCEL_ORDER'].includes(scenario) ? 'WARN' : 'INFO';
      const auditLog = await auditLogService.createLog({
        service_name: service, level, action: scenario,
        message: `[Demo cá nhân] ${actor.username}: ${scenario}`,
        user_id: actor.username, ip_address: req.ip || '127.0.0.1',
        details: { simulated: true, owner_user_id: actor.user_id,
          resource_id: `DEMO-${actor.user_id}`, scenario },
      });
      res.status(201).json({ success: true, data: { auditLog },
        message: 'Sự kiện mẫu đã được ghi nhận cho tài khoản hiện tại.' });
    } catch (error) { next(error); }
  }

  // --------------------------------------------------------------------------
  // AUTH OPERATIONS
  // --------------------------------------------------------------------------
  async loginSuccess(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const username = req.body.username || 'john_doe';
      const ip = req.ip || '192.168.1.101';

      // Auto generate audit log for successful login
      const auditLog = await auditLogService.createLog({
        service_name: 'Auth',
        level: 'INFO',
        action: 'LOGIN_SUCCESS',
        message: `User '${username}' successfully authenticated via password`,
        user_id: username,
        ip_address: ip,
        details: {
          auth_method: 'PASSWORD',
          session_id: uuidv4(),
          user_agent: req.headers['user-agent'] || 'Mozilla/5.0',
        },
      });

      res.status(200).json({
        success: true,
        message: 'Authentication successful',
        data: {
          user: username,
          token: 'demo-session-token-' + uuidv4().substring(0, 8),
          auditLog,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async loginFailed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const username = req.body.username || 'suspicious_user';
      const ip = req.ip || '203.0.113.42';

      // Auto generate audit log for failed login (WARN level)
      const auditLog = await auditLogService.createLog({
        service_name: 'Auth',
        level: 'WARN',
        action: 'LOGIN_FAILED',
        message: `Authentication failed for user '${username}': Invalid credentials provided`,
        user_id: username,
        ip_address: ip,
        details: {
          reason: 'INVALID_CREDENTIALS',
          attempt_number: 3,
          warning: 'Account may be locked after 5 consecutive attempts',
        },
      });

      res.status(401).json({
        success: false,
        message: 'Authentication failed: Invalid credentials',
        data: {
          username,
          auditLog,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const username = req.body.username || 'john_doe';
      const ip = req.ip || '192.168.1.101';

      // Auto generate audit log for logout (INFO level)
      const auditLog = await auditLogService.createLog({
        service_name: 'Auth',
        level: 'INFO',
        action: 'LOGOUT',
        message: `User '${username}' terminated active session gracefully`,
        user_id: username,
        ip_address: ip,
        details: {
          logout_type: 'USER_INITIATED',
          session_duration_minutes: 42,
          timestamp: new Date().toISOString(),
        },
      });

      res.status(200).json({
        success: true,
        message: `User '${username}' logged out successfully`,
        data: {
          user: username,
          auditLog,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // --------------------------------------------------------------------------
  // USER OPERATIONS
  // --------------------------------------------------------------------------
  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.body.user_id || 'usr_' + uuidv4().substring(0, 8);
      const email = req.body.email || `user_${Date.now()}@example.com`;
      const role = req.body.role || 'CUSTOMER';

      // Auto generate audit log for user creation (INFO level)
      const auditLog = await auditLogService.createLog({
        service_name: 'User',
        level: 'INFO',
        action: 'CREATE_USER',
        message: `User '${userId}' created successfully with role '${role}'`,
        user_id: userId,
        ip_address: req.ip || '127.0.0.1',
        details: {
          user_id: userId,
          email,
          role,
          status: 'ACTIVE',
        },
      });

      res.status(201).json({
        success: true,
        message: `User '${userId}' created successfully`,
        data: {
          user_id: userId,
          email,
          role,
          auditLog,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = String(req.params.id || req.body.user_id || 'usr_demo_123');
      const updateFields = req.body.updates || { phone: '+84901234567', department: 'Logistics' };

      // Auto generate audit log for user update (INFO level)
      const auditLog = await auditLogService.createLog({
        service_name: 'User',
        level: 'INFO',
        action: 'UPDATE_USER',
        message: `Profile data updated for user '${userId}'`,
        user_id: userId,
        ip_address: req.ip || '127.0.0.1',
        details: {
          user_id: userId,
          updated_fields: Object.keys(updateFields),
          updated_at: new Date().toISOString(),
        },
      });

      res.status(200).json({
        success: true,
        message: `User '${userId}' profile updated successfully`,
        data: {
          user_id: userId,
          updates: updateFields,
          auditLog,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = String(req.params.id || 'usr_demo_123');

      // Auto generate audit log for user deletion (WARN level)
      const auditLog = await auditLogService.createLog({
        service_name: 'User',
        level: 'WARN',
        action: 'DELETE_USER',
        message: `User '${userId}' soft-deleted and access privileges revoked by admin`,
        user_id: userId,
        ip_address: req.ip || '127.0.0.1',
        details: {
          user_id: userId,
          deleted_by: 'admin',
          reason: 'Account closed by customer request',
        },
      });

      res.status(200).json({
        success: true,
        message: `User '${userId}' deleted successfully`,
        data: {
          user_id: userId,
          auditLog,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // --------------------------------------------------------------------------
  // ORDER OPERATIONS
  // --------------------------------------------------------------------------
  async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
      const amount = req.body.amount || 250.0;
      const customerId = req.body.customer_id || 'usr_customer_88';

      // Auto generate audit log for order creation
      const auditLog = await auditLogService.createLog({
        service_name: 'Order',
        level: 'INFO',
        action: 'CREATE_ORDER',
        message: `New order '${orderId}' placed for customer '${customerId}' totaling $${amount}`,
        user_id: customerId,
        ip_address: req.ip || '192.168.2.15',
        details: {
          order_id: orderId,
          amount,
          items_count: 3,
          currency: 'USD',
          status: 'PENDING_PAYMENT',
        },
      });

      res.status(201).json({
        success: true,
        message: `Order '${orderId}' created successfully`,
        data: {
          order_id: orderId,
          amount,
          customerId,
          auditLog,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = String(req.params.id || req.body.order_id || 'ORD-987654');
      const updates = req.body.updates || { status: 'PREPARING_SHIPMENT', carrier: 'VNPost' };

      // Auto generate audit log for order update
      const auditLog = await auditLogService.createLog({
        service_name: 'Order',
        level: 'INFO',
        action: 'UPDATE_ORDER',
        message: `Order '${orderId}' updated with new fulfillment and shipping parameters`,
        user_id: 'usr_customer_88',
        ip_address: req.ip || '192.168.2.15',
        details: {
          order_id: orderId,
          updates,
          updated_at: new Date().toISOString(),
        },
      });

      res.status(200).json({
        success: true,
        message: `Order '${orderId}' updated successfully`,
        data: {
          order_id: orderId,
          updates,
          auditLog,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = String(req.params.id || 'ORD-987654');
      const reason = req.body.reason || 'Customer changed delivery address';

      // Auto generate audit log for order cancellation
      const auditLog = await auditLogService.createLog({
        service_name: 'Order',
        level: 'WARN',
        action: 'CANCEL_ORDER',
        message: `Order '${orderId}' cancelled before shipment. Reason: ${reason}`,
        user_id: 'usr_customer_88',
        ip_address: req.ip || '192.168.2.15',
        details: {
          order_id: orderId,
          cancellation_reason: reason,
          restock_inventory: true,
        },
      });

      res.status(200).json({
        success: true,
        message: `Order '${orderId}' cancelled successfully`,
        data: {
          order_id: orderId,
          reason,
          auditLog,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = String(req.params.id || 'ORD-987654');

      const auditLog = await auditLogService.createLog({
        service_name: 'Order',
        level: 'WARN',
        action: 'DELETE_ORDER',
        message: `Draft order '${orderId}' purged from temporary cart`,
        user_id: 'usr_customer_88',
        ip_address: req.ip || '192.168.2.15',
        details: { order_id: orderId },
      });

      res.status(200).json({
        success: true,
        message: `Order '${orderId}' deleted`,
        data: { order_id: orderId, auditLog },
      });
    } catch (error) {
      next(error);
    }
  }

  // --------------------------------------------------------------------------
  // PAYMENT OPERATIONS
  // --------------------------------------------------------------------------
  async paymentSuccess(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const txnId = 'TXN-' + Math.floor(1000000 + Math.random() * 9000000);
      const orderId = req.body.order_id || 'ORD-543210';
      const amount = req.body.amount || 250.0;
      const gateway = req.body.gateway || 'Stripe';

      // Auto generate audit log for successful payment (INFO level)
      const auditLog = await auditLogService.createLog({
        service_name: 'Payment',
        level: 'INFO',
        action: 'PAYMENT_SUCCESS',
        message: `Payment transaction '${txnId}' settled successfully via ${gateway} for Order '${orderId}'`,
        user_id: 'usr_customer_88',
        ip_address: req.ip || '10.0.4.12',
        details: {
          transaction_id: txnId,
          order_id: orderId,
          amount,
          currency: 'USD',
          payment_gateway: gateway,
          status: 'SETTLED',
        },
      });

      res.status(200).json({
        success: true,
        message: `Payment '${txnId}' processed successfully`,
        data: {
          transaction_id: txnId,
          order_id: orderId,
          amount,
          status: 'SETTLED',
          auditLog,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async paymentFailed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const txnId = 'TXN-FAIL-' + Math.floor(1000000 + Math.random() * 9000000);
      const orderId = req.body.order_id || 'ORD-543210';
      const errorCode = req.body.error_code || 'GATEWAY_TIMEOUT';
      const errorMessage = req.body.error_message || 'Payment processor timeout: Issuer bank did not respond';

      // Auto generate audit log for failed payment (ERROR level!)
      const auditLog = await auditLogService.createLog({
        service_name: 'Payment',
        level: 'ERROR',
        action: 'PAYMENT_FAILED',
        message: `Payment failed for Order '${orderId}' [${errorCode}]: ${errorMessage}`,
        user_id: 'usr_customer_88',
        ip_address: req.ip || '10.0.4.12',
        details: {
          transaction_id: txnId,
          order_id: orderId,
          error_code: errorCode,
          gateway_error: errorMessage,
          retry_count: 2,
          recommendation: 'Prompt user to retry or switch payment provider',
        },
      });

      res.status(402).json({
        success: false,
        message: 'Payment processing failed',
        data: {
          transaction_id: txnId,
          order_id: orderId,
          error_code: errorCode,
          auditLog,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async paymentRefund(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refundId = 'REF-' + Math.floor(100000 + Math.random() * 900000);
      const txnId = req.body.transaction_id || 'TXN-887766';
      const amount = req.body.amount || 250.0;

      // Auto generate audit log for refund (INFO level)
      const auditLog = await auditLogService.createLog({
        service_name: 'Payment',
        level: 'INFO',
        action: 'REFUND',
        message: `Refund '${refundId}' of $${amount} issued for original transaction '${txnId}'`,
        user_id: 'usr_support_staff',
        ip_address: req.ip || '10.0.4.12',
        details: {
          refund_id: refundId,
          original_transaction: txnId,
          refund_amount: amount,
          status: 'COMPLETED',
        },
      });

      res.status(200).json({
        success: true,
        message: `Refund '${refundId}' processed successfully`,
        data: {
          refund_id: refundId,
          amount,
          auditLog,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const demoController = new DemoController();
