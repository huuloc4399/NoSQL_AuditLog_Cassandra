import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import * as shop from '../services/shopService.js';

const router = Router();
router.use(authenticate);
const itemSchema = z.object({ product_id: z.string(), quantity: z.number().int().min(1).max(10) }).strict();
const shippingSchema = z.object({ name: z.string().trim().min(2).max(80), phone: z.string().regex(/^0[0-9]{9}$/, 'Số điện thoại cần đủ 10 chữ số, bắt đầu bằng 0.'), address: z.string().trim().min(10).max(240) }).strict();
const uuid = z.string().uuid();
router.get('/products', (_req, res) => { res.json({ data: shop.products }); });
router.get('/cart', async (req: AuthenticatedRequest, res, next) => { try { res.json({ data: shop.priceItems(await shop.getCart(req.user!.user_id)) }); } catch (e) { next(e); } });
router.put('/cart', async (req: AuthenticatedRequest, res, next) => { try {
  const body = z.object({ items: z.array(itemSchema).max(4) }).strict().parse(req.body);
  res.json({ data: await shop.withShopLock(req.user!.user_id, () => shop.saveCart(req.user!, body.items)) });
} catch (e) { next(e); } });
router.get('/orders', async (req: AuthenticatedRequest, res, next) => { try { res.json({ data: await shop.listOrders(req.user!.user_id) }); } catch (e) { next(e); } });
router.get('/orders/:id', async (req: AuthenticatedRequest, res, next) => { try { res.json({ data: await shop.getOrder(req.user!.user_id, uuid.parse(req.params.id)) }); } catch (e) { next(e); } });
router.post('/orders', async (req: AuthenticatedRequest, res, next) => { try {
  const body = z.object({ order_id: uuid, shipping: shippingSchema }).strict().parse(req.body);
  res.status(201).json({ data: await shop.withShopLock(req.user!.user_id, () => shop.createOrder(req.user!, body.order_id, body.shipping)) });
} catch (e) { next(e); } });
router.post('/orders/:id/pay', async (req: AuthenticatedRequest, res, next) => { try {
  const id = uuid.parse(req.params.id);
  const body = z.object({ attempt_id: uuid, outcome: z.enum(['success', 'declined', 'timeout']) }).strict().parse(req.body);
  res.json({ data: await shop.withShopLock(req.user!.user_id, () => shop.payOrder(req.user!, id, body.attempt_id, body.outcome)) });
} catch (e) { next(e); } });
router.post('/orders/:id/cancel', async (req: AuthenticatedRequest, res, next) => { try {
  const id = uuid.parse(req.params.id); z.object({}).strict().parse(req.body);
  res.json({ data: await shop.withShopLock(req.user!.user_id, () => shop.cancelOrder(req.user!, id)) });
} catch (e) { next(e); } });
export default router;
