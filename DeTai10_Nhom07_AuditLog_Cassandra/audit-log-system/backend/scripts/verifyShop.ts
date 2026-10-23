import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { connectCassandra, closeCassandra, getCassandraClient } from '../src/config/cassandra.js';

const base = 'http://127.0.0.1:5000/api';
let checks = 0;
const evidence: object[] = [];
async function request(path: string, token = '', method = 'GET', body?: object, status = 200) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result: any = await res.json();
  assert.equal(res.status, status, `${method} ${path}: ${JSON.stringify(result)}`); checks++;
  return result.data;
}
const shipping = { name: 'Test Demo', phone: '0900000000', address: '123 Duong Demo, Phuong Mau, TP Ho Chi Minh' };
const users: { user_id: string; username: string; token: string }[] = [];
async function main() {
const admin = (await request('/auth/login', '', 'POST', { username: 'admin', password: 'admin123' })).token;
try {
  assert.ok(await connectCassandra());
  for (let i = 0; i < 2; i++) {
    const username = `shop_test_${Date.now()}_${i}`;
    const made = await request('/users', admin, 'POST', { username, password: 'ShopTest12345', role: 'USER', full_name: 'Shop Test' }, 201);
    const login = await request('/auth/login', '', 'POST', { username, password: 'ShopTest12345' });
    users.push({ user_id: login.user.user_id, username, token: login.token });
  }
  const [a, b] = users;
  await request('/shop/products', '', 'GET', undefined, 401);
  const products = await request('/shop/products', a.token); assert.equal(products.length, 4); checks++;
  await request('/shop/cart', a.token, 'PUT', { items: [{ product_id: 'missing', quantity: 1 }] }, 400);
  await request('/shop/cart', a.token, 'PUT', { items: [{ product_id: 'mouse', quantity: 11 }] }, 400);
  await request('/shop/cart', a.token, 'PUT', { items: [{ product_id: 'mouse', quantity: 0 }] }, 400);
  await request('/shop/cart', a.token, 'PUT', { items: [{ product_id: 'mouse', quantity: 1, price: 1 }] }, 400);
  await request('/shop/cart', a.token, 'PUT', { items: [{ product_id: 'mouse', quantity: 1 }, { product_id: 'mouse', quantity: 1 }] }, 400);
  await request('/shop/cart', a.token, 'PUT', { items: [{ product_id: 'mouse', quantity: 2 }] });
  assert.equal((await request('/shop/cart', a.token))[0].quantity, 2); checks++;
  await request('/shop/orders', b.token, 'POST', { order_id: randomUUID(), shipping }, 409);
  await request('/shop/orders', a.token, 'POST', { order_id: randomUUID(), shipping, user_id: b.user_id }, 400);
  await request('/shop/orders', a.token, 'POST', { order_id: randomUUID(), shipping: { ...shipping, phone: '12' } }, 400);
  const id = randomUUID();
  const concurrent = await Promise.all([0, 1].map(() => request('/shop/orders', a.token, 'POST', { order_id: id, shipping }, 201)));
  assert.equal(concurrent[0].id, concurrent[1].id); checks++;
  assert.equal(concurrent[0].total, 780000); checks++;
  assert.equal((await request('/shop/orders', a.token)).length, 1); checks++;
  assert.equal((await request('/shop/cart', a.token)).length, 0); checks++;
  await request(`/shop/orders/${id}`, b.token, 'GET', undefined, 404);
  await request(`/shop/orders/${id}/pay`, b.token, 'POST', { attempt_id: randomUUID(), outcome: 'success' }, 404);
  await request(`/shop/orders/${id}/cancel`, b.token, 'POST', {}, 404);
  const attempt = randomUUID();
  const declined = await request(`/shop/orders/${id}/pay`, a.token, 'POST', { attempt_id: attempt, outcome: 'declined' });
  assert.equal(declined.status, 'PAYMENT_FAILED'); checks++;
  const repeated = await request(`/shop/orders/${id}/pay`, a.token, 'POST', { attempt_id: attempt, outcome: 'declined' });
  assert.equal(repeated.attempts.length, 1); checks++;
  const timedOut = await request(`/shop/orders/${id}/pay`, a.token, 'POST', { attempt_id: randomUUID(), outcome: 'timeout' });
  assert.equal(timedOut.status, 'PAYMENT_FAILED'); checks++;
  const success = await request(`/shop/orders/${id}/pay`, a.token, 'POST', { attempt_id: randomUUID(), outcome: 'success' });
  assert.equal(success.status, 'PAID'); checks++;
  const repeatPaid = await request(`/shop/orders/${id}/pay`, a.token, 'POST', { attempt_id: randomUUID(), outcome: 'success' });
  assert.equal(repeatPaid.attempts.length, 3); checks++;
  await request(`/shop/orders/${id}/cancel`, a.token, 'POST', {}, 409);
  await request('/shop/cart', a.token, 'PUT', { items: [{ product_id: 'speaker', quantity: 1 }] });
  const cancelId = randomUUID(); await request('/shop/orders', a.token, 'POST', { order_id: cancelId, shipping }, 201);
  const cancel = await request(`/shop/orders/${cancelId}/cancel`, a.token, 'POST', {});
  assert.equal(cancel.status, 'CANCELLED'); checks++;
  await request(`/shop/orders/${cancelId}/pay`, a.token, 'POST', { attempt_id: randomUUID(), outcome: 'success' }, 409);
  const db = getCassandraClient();
  for (const service of ['Order', 'Payment']) {
    const rows = (await db.execute('SELECT * FROM audit_logs WHERE service_name = ? AND log_date = ?', [service, new Date().toISOString().slice(0, 10)], { prepare: true })).rows.filter(r => r.user_id === a.username);
    for (const row of rows) {
      const details = JSON.parse(row.details);
      assert.equal(details.owner_user_id, a.user_id); checks++;
      assert.ok(!JSON.stringify(details).includes(shipping.address)); checks++;
      assert.ok((await db.execute('SELECT log_id FROM audit_logs_by_id WHERE log_id = ?', [row.log_id], { prepare: true })).rowLength); checks++;
      assert.ok((await db.execute('SELECT log_id FROM audit_logs_by_service_level WHERE service_name = ? AND level = ? AND log_date = ? AND log_time = ? AND log_id = ?', [service, row.level, row.log_date, row.log_time, row.log_id], { prepare: true })).rowLength); checks++;
      evidence.push({ id: row.log_id.toString(), action: row.action, level: row.level, details });
    }
    if (service === 'Order') { assert.equal(rows.filter(r => r.action === 'CREATE_ORDER').length, 2); checks++; }
    if (service === 'Payment') { assert.equal(rows.length, 3); checks++; }
  }
  const report = { status: 'PASSED', checks, tested_at: new Date().toISOString(), database: 'Cassandra', events: evidence };
  writeFileSync('../docs/shop-verification.json', JSON.stringify(report, null, 2));
  console.log(`Shop verification PASSED: ${checks} checks; business data and all three audit copies verified.`);
} finally {
  for (const user of users) {
    await getCassandraClient().execute('DELETE FROM shop_orders WHERE user_id = ?', [user.user_id], { prepare: true });
    await getCassandraClient().execute('DELETE FROM shop_carts WHERE user_id = ?', [user.user_id], { prepare: true });
    await request(`/users/${user.user_id}`, admin, 'DELETE');
  }
  await closeCassandra();
}
}
main().catch(e => { console.error(e); process.exitCode = 1; });
