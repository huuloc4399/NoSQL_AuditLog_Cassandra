import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { connectCassandra, closeCassandra, getCassandraClient, cassandra } from '../src/config/cassandra.js';
import { env } from '../src/config/env.js';

async function verify() {
  assert(await connectCassandra(), 'Cassandra must be available');
  const client = getCassandraClient();
  const origin = `http://127.0.0.1:${env.PORT}/api`;
  const health = await (await fetch(`${origin}/health`)).json() as any;
  assert.equal(health.success, true);
  const login = await (await fetch(`${origin}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD }) })).json() as any;
  assert(login.data?.token && login.data?.user, 'Real API authentication failed');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.token}` };
  const storedAdmin = (await client.execute('SELECT user_id, role FROM audit_log_system.users WHERE username = ?', [login.data.user.username], { prepare: true })).first();
  assert.equal(storedAdmin?.user_id.toString(), login.data.user.user_id, 'API user must match the persisted Cassandra account');
  const event = await (await fetch(`${origin}/demo/orders`, { method: 'POST', headers, body: JSON.stringify({ user_id: 'database_demo', items: [{ product_id: 'DEMO-001', quantity: 1 }], total: 250000 }) })).json() as any;
  const log = event.data?.auditLog;
  assert(log?.log_id, 'The API must return the generated audit event');
  const id = cassandra.types.Uuid.fromString(log.log_id);
  const date = cassandra.types.LocalDate.fromString(log.log_date);
  const time = new Date(log.log_time);
  const copies = await Promise.all([
    client.execute('SELECT log_id FROM audit_log_system.audit_logs_by_id WHERE log_id = ?', [id], { prepare: true }),
    client.execute('SELECT log_id FROM audit_log_system.audit_logs WHERE service_name = ? AND log_date = ? AND log_time = ? AND log_id = ?', [log.service_name, date, time, id], { prepare: true }),
    client.execute('SELECT log_id FROM audit_log_system.audit_logs_by_service_level WHERE service_name = ? AND level = ? AND log_date = ? AND log_time = ? AND log_id = ?', [log.service_name, log.level, date, time, id], { prepare: true }),
  ]);
  assert(copies.every(copy => copy.first()?.log_id.toString() === log.log_id), 'The HTTP event must exist in all three Cassandra tables');
  const read = await (await fetch(`${origin}/logs/${log.log_id}`, { headers })).json() as any;
  assert.equal(read.data?.log_id, log.log_id);
  const local = (await client.execute('SELECT cluster_name, release_version, data_center FROM system.local')).first()!;
  const report = { checked_at: new Date().toISOString(), cluster: local.cluster_name, cassandra_version: local.release_version, datacenter: local.data_center, api_health: health.status, persisted_admin_matches_api: true, http_generated_log_id: log.log_id, persisted_copies: copies.length, api_read_after_write: true };
  const target = path.resolve(process.cwd(), '../../../.runtime/real-database-verification.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
verify().catch(error => { console.error(error); process.exitCode = 1; }).finally(closeCassandra);
