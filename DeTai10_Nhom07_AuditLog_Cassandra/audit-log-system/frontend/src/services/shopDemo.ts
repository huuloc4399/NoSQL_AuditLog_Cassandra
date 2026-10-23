import products from './shopProducts.json';

// Browser-only preview. The normal build always uses the real Cassandra API.
export function handleShopDemo(path: string, method: string, body: any, actor: { user_id: string; username: string }, event: (service: string, action: string, level: any, message: string, user: string) => unknown, ok: (data: any, message?: string, status?: number) => any, fail: (message: string, status?: number) => never) {
  const key = `nep-shop-demo-${actor.user_id}`;
  const state = JSON.parse(localStorage.getItem(key) || '{"cart":[],"orders":[]}');
  const price = (items: any[]) => items.map(i => {
    const product = products.find(p => p.id === i.product_id);
    if (!product || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 10) fail('Sản phẩm hoặc số lượng không hợp lệ.');
    return { product_id: i.product_id, quantity: i.quantity, product, subtotal: product!.price * i.quantity };
  });
  const save = (data: any, action?: string, level = 'INFO') => {
    localStorage.setItem(key, JSON.stringify(state));
    if (action) event(action.startsWith('PAYMENT') ? 'Payment' : 'Order', action, level, 'Giao dịch xem thử trên trình duyệt', actor.username);
    return ok(data);
  };
  if (path === '/shop/products' && method === 'get') return ok(products);
  if (path === '/shop/cart' && method === 'get') return ok(price(state.cart));
  if (path === '/shop/cart' && method === 'put') {
    if (!Array.isArray(body.items) || body.items.length > 4 || new Set(body.items.map((i: any) => i.product_id)).size !== body.items.length) fail('Giỏ hàng không hợp lệ.');
    const data = price(body.items); state.cart = body.items; return save(data, 'UPDATE_CART');
  }
  if (path === '/shop/orders' && method === 'get') return ok(state.orders);
  if (path === '/shop/orders' && method === 'post') {
    const existing = state.orders.find((o: any) => o.id === body.order_id); if (existing) return ok(existing);
    const items = price(state.cart); if (!items.length) fail('Giỏ hàng đang trống.', 409);
    const order = { id: body.order_id, created_at: new Date().toISOString(), status: 'PENDING_PAYMENT', items, total: items.reduce((n: number, i: any) => n + i.subtotal, 0), shipping: body.shipping, attempts: [] };
    state.orders.unshift(order); state.cart = []; return save(order, 'CREATE_ORDER');
  }
  const match = path.match(/^\/shop\/orders\/([^/]+)(?:\/(pay|cancel))?$/);
  if (match) {
    const order = state.orders.find((o: any) => o.id === match[1]); if (!order) fail('Không tìm thấy đơn hàng của bạn.', 404);
    if (method === 'get' && !match[2]) return ok(order);
    if (match[2] === 'cancel' && method === 'post') { if (order.status === 'PAID') fail('Đơn đã thanh toán không thể hủy.', 409); order.status = 'CANCELLED'; return save(order, 'CANCEL_ORDER', 'WARN'); }
    if (match[2] === 'pay' && method === 'post') {
      if (order.status === 'CANCELLED') fail('Đơn đã hủy.', 409);
      if (order.status === 'PAID' || order.attempts.some((a: any) => a.id === body.attempt_id)) return ok(order);
      if (!['success', 'declined', 'timeout'].includes(body.outcome)) fail('Kết quả không hợp lệ.');
      order.attempts.push({ id: body.attempt_id, outcome: body.outcome, at: new Date().toISOString() }); order.status = body.outcome === 'success' ? 'PAID' : 'PAYMENT_FAILED';
      return save(order, body.outcome === 'success' ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED', body.outcome === 'success' ? 'INFO' : 'ERROR');
    }
  }
  return fail('Không tìm thấy chức năng cửa hàng.', 404);
}
