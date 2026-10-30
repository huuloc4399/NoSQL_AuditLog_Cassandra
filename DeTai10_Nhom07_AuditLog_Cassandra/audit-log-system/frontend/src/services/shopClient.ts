/**
 * [BAREM 4] Mô phỏng nghiệp vụ mua hàng ở trình duyệt để tạo sự kiện Audit Log.
 * Khóa localStorage tách theo user_id và api/preview; không đồng bộ đơn giữa các máy.
 * Trình duyệt có thể sửa/xóa localStorage nên không dùng trạng thái/số tiền này làm chứng từ thật.
 */
import { products, type ItemSnapshot } from './shopCatalog';

type Item = { product_id: string; quantity: number };
export type Shipping = { name: string; phone: string; address: string };
export type ShopOrder = {
  id: string; created_at: string; status: 'PENDING_PAYMENT' | 'PAYMENT_FAILED' | 'PAID' | 'CANCELLED';
  items: ItemSnapshot[]; total: number; shipping: Shipping;
  attempts: { id: string; outcome: 'success' | 'declined' | 'timeout'; at: string }[];
};
export type ShopEvent = { event_id: string } & (
  { action: 'ADD_TO_CART' | 'REMOVE_FROM_CART' | 'UPDATE_CART'; items: ItemSnapshot[] } |
  { action: 'CREATE_ORDER'; order_id: string; items: ItemSnapshot[]; amount: number } |
  { action: 'CANCEL_ORDER'; order_id: string } |
  { action: 'PAYMENT_SUCCESS'; order_id: string; payment_id: string; amount: number; attempt: number; outcome: 'success' } |
  { action: 'PAYMENT_FAILED'; order_id: string; payment_id: string; amount: number; attempt: number; outcome: 'declined' | 'timeout' }
);
type WithoutId<T> = T extends unknown ? Omit<T, 'event_id'> : never;
type EventInput = WithoutId<ShopEvent>;
type State = { cart: Item[]; orders: ShopOrder[] };
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const byId = new Map(products.map(product => [product.id, product]));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validId = (id: string) => { if (!uuid.test(id)) throw Error('Mã thao tác mẫu không hợp lệ.'); };

export function priceItems(items: Item[]): ItemSnapshot[] {
  if (!Array.isArray(items) || items.length > products.length || new Set(items.map(i => i.product_id)).size !== items.length) throw Error('Giỏ hàng không hợp lệ.');
  return items.map(item => {
    const product = byId.get(item.product_id);
    if (!product || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) throw Error('Sản phẩm hoặc số lượng không hợp lệ (1–10).');
    return { product_id: item.product_id, quantity: item.quantity, unit_price: product.price, subtotal: product.price * item.quantity };
  });
}

// Chế độ thường và preview dùng chung mô phỏng cục bộ, khác nơi nhận sự kiện audit.
// Lưu localStorage và ghi audit là hai thao tác riêng, không phải một giao dịch nguyên tử.
export function createShopClient(owner: string, mode: 'api' | 'preview', storage: Store, emit: (event: ShopEvent) => Promise<unknown>) {
  const key = `nep-shop-ui-${mode}-${owner}`;
  let queue: Promise<unknown> = Promise.resolve();
  const pending = new Map<string, string>();
  const read = (): State => {
    const saved = storage.getItem(key);
    if (!saved) return { cart: [], orders: [] };
    const state = JSON.parse(saved) as State;
    if (!Array.isArray(state.cart) || !Array.isArray(state.orders)) throw Error('Dữ liệu mua sắm trên trình duyệt không hợp lệ.');
    return state;
  };
  const find = (state: State, id: string) => {
    validId(id);
    const order = state.orders.find(order => order.id === id);
    if (!order) throw Error('Không tìm thấy đơn hàng mẫu trên trình duyệt này.');
    return order;
  };
  const mutate = <T>(task: (state: State) => { data: T; event?: EventInput }) => {
    const result = queue.catch(() => {}).then(async () => {
      const state = read();
      const { data, event } = task(state);
      if (!event) return data;
      const signature = JSON.stringify(event);
      const event_id = pending.get(signature) || crypto.randomUUID();
      pending.set(signature, event_id);
      // Kiểm tra khả năng ghi cục bộ trước, chờ audit được xác nhận rồi lưu trạng thái mới.
      // API lỗi thì giữ trạng thái cũ; nếu lần lưu cuối lỗi, audit có thể đã tồn tại trong DB.
      storage.setItem(key, storage.getItem(key) || JSON.stringify({ cart: [], orders: [] }));
      await emit({ ...event, event_id } as ShopEvent);
      storage.setItem(key, JSON.stringify(state));
      pending.delete(signature);
      return data;
    });
    queue = result;
    return result;
  };
  return {
    getCart: async () => priceItems(read().cart),
    saveCart: (items: Item[]) => mutate(state => {
      const data = priceItems(items);
      if (JSON.stringify(state.cart) === JSON.stringify(items)) return { data };
      const before = state.cart.reduce((sum, i) => sum + i.quantity, 0), after = items.reduce((sum, i) => sum + i.quantity, 0);
      state.cart = items.map(i => ({ product_id: i.product_id, quantity: i.quantity }));
      return { data, event: { action: after > before ? 'ADD_TO_CART' : after < before ? 'REMOVE_FROM_CART' : 'UPDATE_CART', items: data } };
    }),
    listOrders: async () => read().orders,
    getOrder: async (id: string) => find(read(), id),
    createOrder: (id: string, shipping: Shipping) => mutate(state => {
      validId(id);
      const existing = state.orders.find(order => order.id === id);
      if (existing) return { data: existing };
      const clean = { name: shipping.name.trim(), phone: shipping.phone.trim(), address: shipping.address.trim() };
      if (clean.name.length < 2 || clean.name.length > 80 || !/^0[0-9]{9}$/.test(clean.phone) || clean.address.length < 10 || clean.address.length > 240) throw Error('Vui lòng kiểm tra thông tin nhận hàng mẫu.');
      const items = priceItems(state.cart);
      if (!items.length) throw Error('Giỏ hàng đang trống. Hãy chọn sản phẩm trước.');
      const order: ShopOrder = { id, created_at: new Date().toISOString(), status: 'PENDING_PAYMENT', items, total: items.reduce((sum, i) => sum + i.subtotal, 0), shipping: clean, attempts: [] };
      state.orders.unshift(order); state.cart = [];
      return { data: order, event: { action: 'CREATE_ORDER', order_id: id, items, amount: order.total } };
    }),
    payOrder: (id: string, attemptId: string, outcome: string) => mutate(state => {
      validId(attemptId);
      if (outcome !== 'success' && outcome !== 'declined' && outcome !== 'timeout') throw Error('Kết quả thanh toán mẫu không hợp lệ.');
      const order = find(state, id);
      if (order.attempts.some(a => a.id === attemptId) || order.status === 'PAID') return { data: order };
      if (order.status === 'CANCELLED') throw Error('Đơn đã hủy, không thể thanh toán.');
      if (order.attempts.length >= 10) throw Error('Đã hết lượt thử. Vui lòng tạo đơn mẫu mới.');
      order.attempts.push({ id: attemptId, outcome, at: new Date().toISOString() });
      order.status = outcome === 'success' ? 'PAID' : 'PAYMENT_FAILED';
      const details = { order_id: id, payment_id: attemptId, amount: order.total, attempt: order.attempts.length };
      const event: EventInput = outcome === 'success' ? { ...details, action: 'PAYMENT_SUCCESS', outcome } : { ...details, action: 'PAYMENT_FAILED', outcome };
      return { data: order, event };
    }),
    cancelOrder: (id: string) => mutate(state => {
      const order = find(state, id);
      if (order.status === 'CANCELLED') return { data: order };
      if (order.status === 'PAID') throw Error('Đơn đã thanh toán không thể hủy trong bản demo.');
      order.status = 'CANCELLED';
      return { data: order, event: { action: 'CANCEL_ORDER', order_id: id } };
    }),
  };
}
