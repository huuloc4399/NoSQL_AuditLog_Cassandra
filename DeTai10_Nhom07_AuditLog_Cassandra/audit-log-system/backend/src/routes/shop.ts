import { Router } from 'express';
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js';
import { auditLogService } from '../services/auditLogService.js';
import { shopEventSchema } from '../validators/shopEventValidator.js';

const router = Router();
router.use(authenticate);

// This endpoint records a browser simulation. There is no cart/order database.
router.post('/events', async (req: AuthenticatedRequest, res, next) => {
  try {
    const event = shopEventSchema.parse(req.body);
    const actor = req.user!;
    const level = event.action === 'PAYMENT_FAILED' ? 'ERROR' : event.action === 'CANCEL_ORDER' ? 'WARN' : 'INFO';
    const auditLog = await auditLogService.createLog({
      service_name: event.action.startsWith('PAYMENT') ? 'Payment' : 'Order',
      action: event.action, level, user_id: actor.username, ip_address: req.ip,
      message: `${actor.username}: ${event.action} [${event.event_id}]`,
      details: { ...event, simulated: true, source: 'BROWSER_SHOP', owner_user_id: actor.user_id },
    });
    res.status(201).json({ success: true, data: { auditLog } });
  } catch (error) { next(error); }
});

export default router;
