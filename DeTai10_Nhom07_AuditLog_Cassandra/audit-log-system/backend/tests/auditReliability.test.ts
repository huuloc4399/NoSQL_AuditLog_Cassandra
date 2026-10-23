import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import routes from '../src/routes/index.js';
import { userService } from '../src/services/userService.js';
import { serviceCatalogService } from '../src/services/serviceCatalogService.js';
import { auditLogService } from '../src/services/auditLogService.js';
import { getCassandraClient } from '../src/config/cassandra.js';
import { env } from '../src/config/env.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

async function main() {
  const users = userService as any; const client = getCassandraClient();
  const saved = { batch: client.batch, init: users.initDb, users: users.users,
    find: userService.findByUsername, byName: serviceCatalogService.getServiceByName,
    byId: serviceCatalogService.getServiceById, active: serviceCatalogService.isServiceActive };
  const base = { password_hash: 'test-hash', email: 'test@example.com', full_name: 'Before', role: 'USER', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() };
  const admin = { ...base, username: 'admin', user_id: '11111111-1111-4111-8111-111111111111', role: 'ADMIN' };
  const target = { ...base, username: 'target', user_id: '22222222-2222-4222-8222-222222222222' };
  users.users = new Map([['admin', admin], ['target', target]]); users.initDb = async () => {};
  userService.findByUsername = async name => users.users.get(name) || null;
  serviceCatalogService.getServiceByName = async () => null;
  serviceCatalogService.getServiceById = async id => ({service_id:id,service_name:'TestService',description:'',status:true,created_at:new Date(),updated_at:new Date()});
  serviceCatalogService.isServiceActive = async () => ({ exists: true, active: true });
  let fail = false; let captured: any[] = []; let options: any;
  client.batch = (async (queries: any[], opts: any) => {
    captured = queries; options = opts;
    if (fail) { const error = new Error('Injected batch timeout'); error.name = 'OperationTimedOutError'; throw error; }
    return {};
  }) as any;
  const app = express(); app.use(express.json()); app.use('/api', routes); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); if (!address || typeof address === 'string') throw Error('No address');
  const token = jwt.sign({ username: 'admin' }, env.JWT_SECRET, { expiresIn: '1h' });
  let checks = 0;
  async function request(route: string, method: string, body: unknown, expected: number) {
    const response = await fetch(`http://127.0.0.1:${address!.port}/api${route}`, {method,
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    assert.equal(response.status, expected, `${method} ${route}`); checks++;
    return response.json() as Promise<any>;
  }
  function assertAuditBatch(action: string, entity: string) {
    assert.equal(captured.length, 4); assert.equal(options.logged, true); assert.equal(options.prepare, true);
    assert(captured.some(q => q.query.includes(`audit_log_system.${entity}`)));
    for (const table of ['audit_logs ', 'audit_logs_by_id ', 'audit_logs_by_service_level ']) {
      assert(captured.some(q => q.query.includes(table)));
    }
    assert(captured.filter(q => q.query.includes('audit_log_system.audit_logs')).every(q => q.params.includes(action)));
    checks++;
  }
  try {
    await request(`/users/${target.user_id}`, 'PUT', { full_name: 'After', email: 'changed@example.com' }, 200);
    assertAuditBatch('UPDATE_USER', 'users'); assert.equal(users.users.get('target').full_name, 'After'); checks++;
    fail = true;
    await request(`/users/${target.user_id}`, 'PUT', { full_name: 'Should not enter cache' }, 503);
    assert.equal(users.users.get('target').full_name, 'After'); checks++;
    fail = false;
    for (const [method, route, body, action, status] of [
      ['POST','/services',{service_name:'TestService'},'CREATE_SERVICE',201],
      ['PUT','/services/33333333-3333-4333-8333-333333333333',{description:'Updated'},'UPDATE_SERVICE',200],
      ['DELETE','/services/33333333-3333-4333-8333-333333333333',undefined,'DELETE_SERVICE',200],
    ] as const) {
      await request(route,method,body,status); assertAuditBatch(action,'services');
      fail = true; await request(route,method,body,503); fail = false;
    }
    fail = true;
    await request('/logs','POST',{service_name:'Order',level:'ERROR',action:'BATCH_FAULT',message:'Must not report success'},503);
    assert.equal(captured.length,3); assert.equal(options.logged,true); checks++;
    fail = false;
    await request(`/users/${target.user_id}`, 'PUT', { role: 'ADMIN' }, 400);
    await request('/auth/register','POST',{username:'registered',password:'password123'},201);
    assertAuditBatch('REGISTER_USER','users');
    serviceCatalogService.isServiceActive = async () => ({ exists: true, active: false });
    await request(`/users/${target.user_id}`, 'PUT', { full_name: 'Control plane remains available' }, 200);
    assertAuditBatch('UPDATE_USER','users');
    await request('/logs','POST',{service_name:'Order',level:'INFO',action:'INACTIVE',message:'External ingestion stays blocked',internal:true},400);
    console.log(`${checks} audit reliability checks passed (fault injection; no Cassandra writes).`);
  } finally {
    client.batch = saved.batch; users.initDb = saved.init; users.users = saved.users;
    userService.findByUsername = saved.find; serviceCatalogService.getServiceByName = saved.byName;
    serviceCatalogService.getServiceById = saved.byId; serviceCatalogService.isServiceActive = saved.active;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}
main().catch(error => { console.error(error); process.exitCode=1; });
