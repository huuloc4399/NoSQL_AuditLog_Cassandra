import { z } from 'zod';

const uuid = z.string().uuid();
const money = z.number().int().min(0).max(1000000000);
const item = z.object({
  product_id: z.string().regex(/^[a-z0-9_-]{1,50}$/),
  quantity: z.number().int().min(1).max(10), unit_price: money, subtotal: money,
}).strict();
const items = z.array(item).max(4);
const common = { event_id: uuid };
const payment = { ...common, order_id: uuid, payment_id: uuid, amount: money, attempt: z.number().int().min(1).max(10) };

export const shopEventSchema = z.union([
  z.object({ ...common, action: z.enum(['ADD_TO_CART', 'REMOVE_FROM_CART', 'UPDATE_CART']), items }).strict(),
  z.object({ ...common, action: z.literal('CREATE_ORDER'), order_id: uuid, items: items.min(1), amount: money }).strict(),
  z.object({ ...common, action: z.literal('CANCEL_ORDER'), order_id: uuid }).strict(),
  z.object({ ...payment, action: z.literal('PAYMENT_SUCCESS'), outcome: z.literal('success') }).strict(),
  z.object({ ...payment, action: z.literal('PAYMENT_FAILED'), outcome: z.enum(['declined', 'timeout']) }).strict(),
]).superRefine((event, ctx) => {
  if ('items' in event) {
    if (new Set(event.items.map(i => i.product_id)).size !== event.items.length ||
        event.items.some(i => i.subtotal !== i.quantity * i.unit_price) ||
        ('amount' in event && event.amount !== event.items.reduce((sum, i) => sum + i.subtotal, 0))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Chi tiết giao dịch mẫu không hợp lệ.' });
    }
  }
});
