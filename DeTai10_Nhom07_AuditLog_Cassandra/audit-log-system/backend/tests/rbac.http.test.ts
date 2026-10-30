import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import routes from '../src/routes/index.js';
import { userService, User } from '../src/services/userService.js';
import { auditLogService } from '../src/services/auditLogService.js';
import { env } from '../src/config/env.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

// Exercise the real HTTP router, authentication and authorization without a database.
async function main() {
const base = { password_hash: 'not-used', full_name: 'Test Account', email: 'test@example.com', status: 'ACTIVE' as const, created_at: new Date(), updated_at: new Date() };
const records: Record<string, User> = {
  admin: { ...base, user_id: '11111111-1111-4111-8111-111111111111', username: 'admin', role: 'ADMIN' },
  user: { ...base, user_id: '22222222-2222-4222-8222-222222222222', username: 'user', role: 'USER' },
  disabled: { ...base, user_id: '33333333-3333-4333-8333-333333333333', username: 'disabled', role: 'ADMIN', status: 'INACTIVE' },
};
const originals = { find: userService.findByUsername, all: userService.getAllUsers, create: userService.createUser, log: auditLogService.createLog, query: auditLogService.queryLogs, detail: auditLogService.getLogById, summary: auditLogService.getDashboardSummary };
let registrationRole: string | undefined;
let lastPersonalLog: any;
let auditReads = 0;
const testLog = { log_id: '44444444-4444-4444-8444-444444444444', service_name: 'Order', log_date: '2026-10-30', log_time: '2026-10-30T00:00:00.000Z', level: 'INFO', action: 'CREATE_ORDER', user_id: 'user', message: 'Test audit' };
auditLogService.queryLogs = async () => { auditReads++; return { logs: [testLog], count: 1, page_state: null } as any; };
auditLogService.getLogById = async () => { auditReads++; return testLog as any; };
auditLogService.getDashboardSummary = async () => { auditReads++; return { totalLogs: 1, byLevel: { INFO: 1 }, byService: { Order: 1 } } as any; };
userService.findByUsername = async username => records[username] || null;
userService.getAllUsers = async () => Object.values(records).map(userService.toSafeUser);
userService.createUser = async data => { registrationRole = data.role; return { ...userService.toSafeUser(records.user), username: data.username }; };
auditLogService.createLog = async input => { lastPersonalLog = input; return ({ ...input, log_id: '44444444-4444-4444-8444-444444444444' } as any); };
const app = express(); app.use(express.json()); app.use('/api', routes); app.use(errorHandler);
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address(); if (!address || typeof address === 'string') throw new Error('Server address unavailable');
const url = `http://127.0.0.1:${address.port}/api`;
const token = (username: string, role = records[username]?.role || 'ADMIN') => jwt.sign({ username, role }, env.JWT_SECRET, { expiresIn: '1h' });
let passed = 0;
const request = async (path: string, expected: number, auth?: string, method = 'GET', body?: unknown) => { const res = await fetch(url + path, { method, headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); assert.equal(res.status, expected, `${method} ${path}`); passed++; console.log(`PASS ${method} ${path}: ${expected}`); return res; };
try {
  await request('/users', 401);
  await request('/users', 401, 'invalid-token');
  await request('/users', 401, jwt.sign({ username: 'admin' }, 'wrong-secret'));
  await request('/users', 401, jwt.sign({ username: 'admin' }, env.JWT_SECRET, { expiresIn: -1 }));
  await request('/users', 401, token('missing'));
  await request('/users', 401, token('disabled'));
  for (const path of ['/users', '/services', '/system/status', '/logs/ttl-status/11111111-1111-4111-8111-111111111111']) await request(path, 403, token('user'));
  for (const path of ['/users', '/services', '/logs', '/logs/ttl-demo', '/demo/orders', '/demo/payments/failed', '/demo/prepare-today']) await request(path, 403, token('user'), 'POST', {});
  await request('/users/target/role', 403, token('user'), 'PATCH', { role: 'ADMIN' });
  await request('/users/target', 403, token('user'), 'DELETE');
  await request('/users', 200, token('admin'));
  await request('/auth/me', 200, token('user'));
  // Chặn cả URL danh sách, khóa tổng hợp, UUID và thống kê trước khi truy vấn audit.
  const auditReadPaths = [
    '/logs',
    `/logs/${testLog.log_id}`,
    `/logs/detail?service=Order&date=${testLog.log_date}&time=${encodeURIComponent(testLog.log_time)}&id=${testLog.log_id}`,
    '/logs/stats/summary',
  ];
  for (const path of auditReadPaths) {
    await request(path, 401);
    const denied = await request(path, 403, token('user'));
    assert.equal((await denied.json() as any).data, undefined);
    await request(path, 403, token('user', 'ADMIN'));
  }
  await request('/logs?level=INVALID', 403, token('user'));
  assert.equal(auditReads, 0); passed++;
  for (const path of auditReadPaths) {
    const result = await (await request(path, 200, token('admin'))).json() as any;
    assert.equal(result.success, true);
    assert.ok(result.data);
  }
  assert.equal(auditReads, auditReadPaths.length); passed++;
  await request('/logs?level=INVALID', 400, token('admin'));
  // A forged role claim cannot override the role currently stored for this account.
  await request('/users', 403, token('user', 'ADMIN'));
  for (const role of ['OPERATOR', 'VIEWER', 'ROOT']) await request('/users', 400, token('admin'), 'POST', { username: 'newuser', password: 'password123', role });
  const registration = await request('/auth/register', 201, undefined, 'POST', { username: 'newuser', password: 'password123', role: 'ADMIN' });
  assert.equal(registrationRole, 'USER'); assert.equal((await registration.json() as any).data.user.role, 'USER'); passed++;
  const safeResponse = await (await request('/users', 200, token('admin'))).json() as any;
  assert(safeResponse.data.every((u: Record<string, unknown>) => !('password_hash' in u))); passed++;
  await request('/demo/my-actions', 401, undefined, 'POST', { scenario: 'CREATE_ORDER' });
  for (const scenario of ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'UPDATE_USER', 'CREATE_ORDER', 'UPDATE_ORDER', 'CANCEL_ORDER', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED']) {
    await request('/demo/my-actions', 201, token('user'), 'POST', { scenario });
    assert.equal(lastPersonalLog.user_id, 'user');
    assert.equal(lastPersonalLog.details.owner_user_id, records.user.user_id);
    assert.equal(lastPersonalLog.details.simulated, true);
    if (scenario === 'PAYMENT_FAILED') assert.equal(lastPersonalLog.level, 'ERROR');
    passed++;
  }
  await request('/demo/my-actions', 400, token('user'), 'POST', { scenario: 'DELETE_USER' });
  await request('/demo/my-actions', 400, token('user'), 'POST', { scenario: 'CREATE_ORDER', user_id: records.admin.user_id });
  auditLogService.createLog = async () => { const error = new Error('Injected personal demo write timeout'); error.name='OperationTimedOutError'; throw error; };
  await request('/demo/my-actions', 503, token('user'), 'POST', { scenario: 'CREATE_ORDER' });
  console.log(`\n${passed} HTTP / RBAC checks passed. Cassandra was not used.`);
} finally {
  userService.findByUsername = originals.find; userService.getAllUsers = originals.all; userService.createUser = originals.create; auditLogService.createLog = originals.log;
  auditLogService.queryLogs = originals.query; auditLogService.getLogById = originals.detail; auditLogService.getDashboardSummary = originals.summary;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
}
main().catch(error => { console.error(error); process.exitCode = 1; });
