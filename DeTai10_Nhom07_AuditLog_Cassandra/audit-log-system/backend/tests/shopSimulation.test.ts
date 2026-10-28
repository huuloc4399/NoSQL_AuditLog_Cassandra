import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import routes from '../src/routes/index.js';
import { env } from '../src/config/env.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { userService } from '../src/services/userService.js';
import { serviceCatalogService } from '../src/services/serviceCatalogService.js';
import { getCassandraClient } from '../src/config/cassandra.js';
import { shopEventSchema } from '../src/validators/shopEventValidator.js';
import { createShopClient, priceItems, type ShopEvent } from '../../frontend/src/services/shopClient.js';
import { products, displayItems } from '../../frontend/src/services/shopCatalog.js';

async function main() {
  let checks = 0;
  const eq = (actual: unknown, expected: unknown) => { assert.deepEqual(actual, expected); checks++; };
  const rejects = async (task: Promise<unknown>) => { await assert.rejects(task); checks++; };
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const events: ShopEvent[] = [];
  let failAudit = false;
  const emit = async (event: ShopEvent) => { shopEventSchema.parse(event); events.push(event); if (failAudit) throw Error('Audit unavailable'); };
  const a = createShopClient('a', 'api', storage, emit), b = createShopClient('b', 'api', storage, emit);
  const shipping = { name: 'Demo User', phone: '0900000000', address: '123 Duong Demo, Phuong Mau' };
  for (const product of products) {
    const [item] = priceItems([{ product_id: product.id, quantity: 2 }]);
    eq(item.subtotal, product.price * 2);
    eq(Object.keys(item).sort(), ['product_id', 'quantity', 'subtotal', 'unit_price']);
    eq(displayItems([item])[0].product.name, product.name);
  }
  for (const id of ['missing', 'constructor', '__proto__']) { assert.throws(() => priceItems([{ product_id: id, quantity: 1 }])); checks++; }
  for (const quantity of [0, 11, 1.5, -1]) await rejects(a.saveCart([{ product_id: 'mouse', quantity }]));
  await rejects(a.saveCart([{ product_id: 'mouse', quantity: 1 }, { product_id: 'mouse', quantity: 1 }]));
  await a.saveCart([{ product_id: 'mouse', quantity: 2 }]);
  eq((await a.getCart())[0].subtotal, 780000);
  eq(await b.getCart(), []);
  eq(await createShopClient('a', 'preview', storage, emit).getCart(), []);
  const id = randomUUID();
  await rejects(a.createOrder(id, { ...shipping, phone: '12' }));
  const before = events.length;
  const [order, repeated] = await Promise.all([a.createOrder(id, shipping), a.createOrder(id, shipping)]);
  eq(order, repeated); eq(events.length, before + 1); eq(await a.getCart(), []);
  eq((await a.listOrders()).length, 1);
  await rejects(b.getOrder(id));
  await rejects(b.payOrder(id, randomUUID(), 'success'));
  const declined = randomUUID();
  eq((await a.payOrder(id, declined, 'declined')).status, 'PAYMENT_FAILED');
  eq((await a.payOrder(id, declined, 'declined')).attempts.length, 1);
  eq((await a.payOrder(id, randomUUID(), 'success')).status, 'PAID');
  eq((await a.payOrder(id, randomUUID(), 'success')).attempts.length, 2);
  await rejects(a.cancelOrder(id));
  eq((await createShopClient('a', 'api', storage, emit).getOrder(id)).total, 780000);
  eq(events.some(event => JSON.stringify(event).includes(shipping.address)), false);
  eq(Object.keys((await a.getOrder(id)).items[0]).sort(), ['product_id', 'quantity', 'subtotal', 'unit_price']);
  failAudit = true;
  await rejects(a.saveCart([{ product_id: 'speaker', quantity: 1 }]));
  eq(await a.getCart(), []);
  const failedId = events.at(-1)!.event_id;
  failAudit = false;
  await a.saveCart([{ product_id: 'speaker', quantity: 1 }]);
  eq(events.at(-1)!.event_id, failedId);
  const cancelId = randomUUID(); await a.createOrder(cancelId, shipping);
  eq((await a.cancelOrder(cancelId)).status, 'CANCELLED');
  const cancelledCount = events.length;
  await a.cancelOrder(cancelId); eq(events.length, cancelledCount);
  await rejects(a.payOrder(cancelId, randomUUID(), 'success'));
  const blocked = createShopClient('blocked', 'api', { getItem: () => null, setItem: () => { throw Error('Storage denied'); } }, emit);
  const previousEvents = events.length;
  await rejects(blocked.saveCart([{ product_id: 'mouse', quantity: 1 }]));
  eq(events.length, previousEvents);

  // Exercise the actual authenticated route and inspect the only Cassandra write: audit batch.
  const db = getCassandraClient();
  const saved = { batch: db.batch, find: userService.findByUsername, active: serviceCatalogService.isServiceActive };
  let captured: any[] = [], failBatch = false, batchCalls = 0;
  const user = { user_id: randomUUID(), username: 'shop_test', role: 'USER', status: 'ACTIVE' };
  userService.findByUsername = async () => user as any;
  serviceCatalogService.isServiceActive = async () => ({ exists: true, active: true });
  db.batch = (async (queries: any[]) => { batchCalls++; captured = queries; if (failBatch) { const error = Error('Injected shop audit timeout'); error.name = 'OperationTimedOutError'; throw error; } return {}; }) as any;
  const app = express(); app.use(express.json()); app.use('/api', routes); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); if (!address || typeof address === 'string') throw Error('No server address');
  const token = jwt.sign({ username: user.username }, env.JWT_SECRET, { expiresIn: '1h' });
  const call = async (path: string, body: unknown, status: number, authenticated = true, method = 'POST') => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) }, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) });
    eq(response.status, status);
    return response;
  };
  try {
    await call('/shop/events', events[0], 401, false);
    for (const path of ['/shop/cart', '/shop/orders', '/shop/products']) await call(path, undefined, 404, true, 'GET');
    const event = events.find(event => event.action === 'CREATE_ORDER')!;
    const response = await call('/shop/events', { ...event, event_id: randomUUID() }, 201);
    const audit = (await response.json() as any).data.auditLog;
    eq(audit.user_id, user.username); eq(audit.action, 'CREATE_ORDER'); eq(audit.service_name, 'Order');
    const details = JSON.parse(audit.details);
    eq(details.owner_user_id, user.user_id); eq(details.source, 'BROWSER_SHOP'); eq(details.simulated, true);
    eq(captured.length, 3);
    eq(captured.every(q => /INSERT INTO audit_log_system\.audit_logs/.test(q.query)), true);
    const calls = batchCalls;
    for (const extra of [{ user_id: 'other' }, { owner_user_id: randomUUID() }, { shipping }, { internal: true }, { role: 'ADMIN' }]) await call('/shop/events', { ...event, ...extra }, 400);
    await call('/shop/events', { ...event, action: 'DROP_TABLE' }, 400);
    await call('/shop/events', { ...event, amount: 1 }, 400);
    await call('/shop/events', { ...event, items: [{ product_id: 'mouse', quantity: 2, unit_price: 3, subtotal: 1 }] }, 400);
    eq(batchCalls, calls);
    const pay = events.find(event => event.action === 'PAYMENT_FAILED')!;
    const payResponse = await call('/shop/events', { ...pay, event_id: randomUUID() }, 201);
    const payLog = (await payResponse.json() as any).data.auditLog;
    eq(payLog.service_name, 'Payment'); eq(payLog.level, 'ERROR');
    failBatch = true;
    await call('/shop/events', { ...event, event_id: randomUUID() }, 503);
    console.log(`Shop simulation PASSED: ${checks} checks; local carts/orders, account scopes, payment/retry, audit-only API, identity and failure handling.`);
  } finally {
    db.batch = saved.batch; userService.findByUsername = saved.find; serviceCatalogService.isServiceActive = saved.active;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await db.shutdown();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
