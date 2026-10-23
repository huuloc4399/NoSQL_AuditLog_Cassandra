import { getCassandraClient } from '../config/cassandra.js';
import { auditLogService } from './auditLogService.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const products = [
  { id: 'headphones', name: 'Tai nghe không dây AirTone', category: 'Âm thanh', price: 1290000, oldPrice: 1590000, image: '/products/headphones.png', badge: 'Được yêu thích', description: 'Êm tai, nhẹ nhàng. Kết nối Bluetooth, thời lượng pin mẫu 40 giờ và đệm tai mềm cho góc làm việc của bạn.', specs: ['Bluetooth 5.3', 'Pin 40 giờ', 'Màu xanh sage'] },
  { id: 'keyboard', name: 'Bàn phím cơ Studio 75', category: 'Góc làm việc', price: 890000, oldPrice: 1090000, image: '/products/keyboard.png', badge: 'Lựa chọn mới', description: 'Bố cục nhỏ gọn, phím bấm êm và phối màu kem xanh. Một điểm nhấn vừa đủ cho bàn làm việc.', specs: ['Bố cục 75%', 'Kết nối USB-C', 'Switch êm'] },
  { id: 'mouse', name: 'Chuột không dây Pebble', category: 'Góc làm việc', price: 390000, oldPrice: 490000, image: '/products/mouse.png', badge: '', description: 'Thiết kế gọn trong lòng bàn tay, thao tác yên tĩnh và kết nối không dây tiện lợi mỗi ngày.', specs: ['Kết nối không dây', 'Click yên tĩnh', 'Màu xanh sage'] },
  { id: 'speaker', name: 'Loa Bluetooth Mini Sound', category: 'Âm thanh', price: 690000, oldPrice: 850000, image: '/products/speaker.png', badge: 'Nhỏ mà hay', description: 'Âm nhạc theo bạn từ góc bàn đến chuyến đi cuối tuần. Lớp vải dệt ấm áp, thiết kế dễ mang theo.', specs: ['Bluetooth 5.3', 'Pin mẫu 12 giờ', 'Màu cát'] },
];
type Item = { product_id: string; quantity: number };
type Actor = NonNullable<AuthenticatedRequest['user']>;
type Shipping = { name: string; phone: string; address: string };
type Order = { id: string; created_at: string; status: string; items: ReturnType<typeof priceItems>; total: number; shipping: Shipping; attempts: { id: string; outcome: string; at: string }[]; audit_id?: string };
const locks = new Map<string, Promise<unknown>>();
// Serializes one shopper's writes in this single-server demo. Not a distributed lock.
export async function withShopLock<T>(owner: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(owner) || Promise.resolve();
  const current = previous.catch(() => {}).then(task);
  locks.set(owner, current);
  try { return await current; } finally { if (locks.get(owner) === current) locks.delete(owner); }
}
export function priceItems(items: Item[]) {
  const ids = new Set<string>();
  return items.map(item => {
    const product = products.find(p => p.id === item.product_id);
    if (!product || ids.has(item.product_id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) throw new AppError('Sản phẩm hoặc số lượng không hợp lệ (tối đa 10 mỗi sản phẩm).', 400);
    ids.add(item.product_id);
    return { ...item, product, subtotal: product.price * item.quantity };
  });
}
export async function initShop() {
  const db = getCassandraClient();
  await db.execute('CREATE TABLE IF NOT EXISTS shop_carts (user_id uuid PRIMARY KEY, payload text)');
  await db.execute('CREATE TABLE IF NOT EXISTS shop_orders (user_id uuid, order_id uuid, payload text, PRIMARY KEY ((user_id), order_id))');
}
export async function getCart(owner: string): Promise<Item[]> {
  const row = (await getCassandraClient().execute('SELECT payload FROM shop_carts WHERE user_id = ?', [owner], { prepare: true })).first();
  return row ? JSON.parse(row.payload) : [];
}
async function audit(actor: Actor, service: string, action: string, level: 'INFO' | 'WARN' | 'ERROR', details: object, mutations: { query: string; params: any[] }[]) {
  return auditLogService.createLog({ service_name: service, action, level, user_id: actor.username, message: `${actor.username}: ${action}`, details: { simulated: true, owner_user_id: actor.user_id, ...details } }, mutations);
}
export async function saveCart(actor: Actor, items: Item[]) {
  const priced = priceItems(items);
  const old = await getCart(actor.user_id);
  if (JSON.stringify(old) === JSON.stringify(items)) return priced;
  const oldCount = old.reduce((n, i) => n + i.quantity, 0), count = items.reduce((n, i) => n + i.quantity, 0);
  await audit(actor, 'Order', count > oldCount ? 'ADD_TO_CART' : count < oldCount ? 'REMOVE_FROM_CART' : 'UPDATE_CART', 'INFO', { items }, [{ query: 'INSERT INTO shop_carts (user_id, payload) VALUES (?, ?)', params: [actor.user_id, JSON.stringify(items)] }]);
  return priced;
}
export async function getOrder(owner: string, id: string): Promise<Order> {
  const row = (await getCassandraClient().execute('SELECT payload FROM shop_orders WHERE user_id = ? AND order_id = ?', [owner, id], { prepare: true })).first();
  if (!row) throw new AppError('Không tìm thấy đơn hàng của bạn.', 404);
  return JSON.parse(row.payload);
}
export async function listOrders(owner: string) {
  const result = await getCassandraClient().execute('SELECT payload FROM shop_orders WHERE user_id = ?', [owner], { prepare: true });
  return result.rows.map(row => JSON.parse(row.payload) as Order).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
const writeOrder = (owner: string, order: Order) => ({ query: 'INSERT INTO shop_orders (user_id, order_id, payload) VALUES (?, ?, ?)', params: [owner, order.id, JSON.stringify(order)] });
export async function createOrder(actor: Actor, id: string, shipping: Shipping) {
  try { return await getOrder(actor.user_id, id); } catch (error) { if (!(error instanceof AppError) || error.statusCode !== 404) throw error; }
  const items = priceItems(await getCart(actor.user_id));
  if (!items.length) throw new AppError('Giỏ hàng đang trống. Hãy chọn sản phẩm trước.', 409);
  const order: Order = { id, created_at: new Date().toISOString(), status: 'PENDING_PAYMENT', items, total: items.reduce((n, i) => n + i.subtotal, 0), shipping, attempts: [] };
  await audit(actor, 'Order', 'CREATE_ORDER', 'INFO', { order_id: id, total: order.total, currency: 'VND', items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity })) }, [writeOrder(actor.user_id, order), { query: 'INSERT INTO shop_carts (user_id, payload) VALUES (?, ?)', params: [actor.user_id, '[]'] }]);
  return order;
}
export async function payOrder(actor: Actor, id: string, attemptId: string, outcome: string) {
  const order = await getOrder(actor.user_id, id);
  if (order.attempts.some(a => a.id === attemptId) || order.status === 'PAID') return order;
  if (order.status === 'CANCELLED') throw new AppError('Đơn đã hủy, không thể thanh toán.', 409);
  if (order.attempts.length >= 10) throw new AppError('Đã hết lượt thử của đơn mẫu này. Vui lòng tạo đơn mới.', 409);
  order.attempts.push({ id: attemptId, outcome, at: new Date().toISOString() });
  order.status = outcome === 'success' ? 'PAID' : 'PAYMENT_FAILED';
  await audit(actor, 'Payment', outcome === 'success' ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED', outcome === 'success' ? 'INFO' : 'ERROR', { order_id: id, payment_id: attemptId, outcome, amount: order.total, currency: 'VND', attempt: order.attempts.length }, [writeOrder(actor.user_id, order)]);
  return order;
}
export async function cancelOrder(actor: Actor, id: string) {
  const order = await getOrder(actor.user_id, id);
  if (order.status === 'CANCELLED') return order;
  if (order.status === 'PAID') throw new AppError('Đơn đã thanh toán không thể hủy trong bản demo.', 409);
  order.status = 'CANCELLED';
  await audit(actor, 'Order', 'CANCEL_ORDER', 'WARN', { order_id: id, reason: 'customer_request' }, [writeOrder(actor.user_id, order)]);
  return order;
}
