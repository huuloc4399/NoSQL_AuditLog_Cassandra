import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import cassandra from 'cassandra-driver';
import routes from '../src/routes/index.js';
import { cqlConsoleService, parseConsoleQuery } from '../src/services/cqlConsoleService.js';
import { getCassandraClient } from '../src/config/cassandra.js';
import { env } from '../src/config/env.js';
import { userService } from '../src/services/userService.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

async function main() {
  let checks = 0;
  for (const query of [
    'SELECT * FROM audit_logs;',
    'select log_id, TTL(message) AS remaining_seconds from audit_logs_by_id;',
    'SELECT COUNT(*) AS total FROM audit_logs;',
    'SELECT WRITETIME(message) FROM audit_logs_by_id;',
    "SELECT message FROM audit_logs WHERE message = 'a; DELETE FROM users; it''s text'; -- comment",
    '/* demo */ SELECT username FROM users; // comment',
    'DESCRIBE TABLES;', 'DESC TABLE audit_logs;',
    'DESCRIBE TABLE audit_log_system.users;', 'USE audit_log_system;',
  ]) { assert.ok(parseConsoleQuery(query)); checks++; }
  for (const query of [
    '', ' '.repeat(8001), 'DROP TABLE audit_logs;', 'TRUNCATE users;',
    'UPDATE users SET role = \'ADMIN\' WHERE username = \'user\';',
    'INSERT INTO services (service_name) VALUES (\'X\');',
    'BEGIN BATCH DELETE FROM users; APPLY BATCH;',
    'SELECT * FROM audit_logs; DROP TABLE users;',
    'SELECT * FROM audit_logs; /* comment */ SELECT * FROM users;',
    'SELECT * FROM audit_logs;;', 'SELECT * FROM system.local;',
    'SELECT * FROM system_schema.tables;', 'SELECT * FROM unrelated;',
    'SELECT * FROM other_keyspace.users;', 'SELECT * FROM audit_log_system.users.extra;',
    'SELECT password_hash FROM users;', 'SELECT password_hash AS name FROM users;',
    "SELECT username FROM users WHERE password_hash = 'guess';",
    'SELECT JSON * FROM users;', 'SELECT "password_hash" FROM users;',
    'SELECT max(password_hash) FROM users;', 'SELECT made_up_column FROM users;',
    'USE system;', 'DESCRIBE TABLE system.local;',
    "SELECT message FROM audit_logs WHERE message = 'unclosed;",
    'SELECT * FROM audit_logs /* unclosed',
  ]) { assert.throws(() => parseConsoleQuery(query), (e: any) => e.statusCode === 400, query); checks++; }
  const expanded = parseConsoleQuery('SELECT * FROM users;');
  assert.ok(expanded.kind === 'select' && expanded.query.includes('username') && !expanded.query.includes('password_hash')); checks++;

  const client = getCassandraClient();
  const saved = { execute: client.execute, find: userService.findByUsername };
  let calls = 0, mode = 'rows', captured = '', options: any;
  (client as any).execute = async (query: string, params: unknown[], opts: any) => {
    calls++; captured = query; options = opts;
    if (mode === 'timeout') { const e = new Error('Injected CQL timeout'); e.name = 'OperationTimedOutError'; throw e; }
    if (mode === 'syntax') throw new cassandra.errors.ResponseError(0x2000, 'Test syntax error');
    if (query.includes('system_schema.tables')) return { rows: [{ table_name: 'users' }, { table_name: 'audit_logs' }, { table_name: 'unrelated' }] };
    if (query.includes('system_schema.columns')) return { rows: [
      { column_name: 'service_name', type: 'text', kind: 'partition_key', position: 0 },
      { column_name: 'log_date', type: 'date', kind: 'partition_key', position: 1 },
      { column_name: 'log_time', type: 'timestamp', kind: 'clustering', position: 0, clustering_order: 'desc' },
      { column_name: 'log_id', type: 'uuid', kind: 'clustering', position: 1, clustering_order: 'asc' },
      { column_name: 'message', type: 'text', kind: 'regular', position: -1 },
    ] };
    return { rows: Array.from({ length: mode === 'large' ? 105 : mode === 'empty' ? 0 : 1 }, () => ({ log_time: new Date('2026-10-30T00:00:00Z'), count: cassandra.types.Long.fromInt(12), message: '<script>alert(1)</script>' })), columns: [{ name: 'log_time' }, { name: 'count' }, { name: 'message' }], pageState: mode === 'large' ? 'next' : null };
  };
  userService.findByUsername = async username => ({ username, role: username === 'admin' ? 'ADMIN' : 'USER', status: 'ACTIVE', user_id: '11111111-1111-4111-8111-111111111111' } as any);
  const app = express(); app.use(express.json()); app.use('/api', routes); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); if (!address || typeof address === 'string') throw Error('No server address');
  const url = `http://127.0.0.1:${address.port}/api/admin/cql`;
  const token = (username: string, role = 'ADMIN') => jwt.sign({ username, role }, env.JWT_SECRET, { expiresIn: '1h' });
  const request = async (body: unknown, status: number, auth?: string) => {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(body) });
    assert.equal(response.status, status); checks++;
    return response.json() as Promise<any>;
  };
  try {
    await request({ query: 'SELECT * FROM audit_logs;' }, 401);
    await request({ query: 'SELECT * FROM audit_logs;' }, 401, 'invalid');
    await request({ query: 'SELECT * FROM audit_logs;' }, 403, token('user'));
    await request({ query: 'DROP TABLE users;' }, 403, token('user', 'ADMIN'));
    assert.equal(calls, 0); checks++;
    for (const body of [{}, { query: '' }, { query: 1 }, { query: 'a'.repeat(8001) }, { query: 'SELECT * FROM users', admin: true }, { query: 'DELETE FROM users;' }]) await request(body, 400, token('admin'));
    assert.equal(calls, 0); checks++;
    const result = await request({ query: 'SELECT * FROM audit_logs;' }, 200, token('admin'));
    assert.equal(result.data.rows[0].log_time, '2026-10-30T00:00:00.000Z'); checks++;
    assert.equal(result.data.rows[0].count, '12'); checks++;
    assert.equal(result.data.rows[0].message, '<script>alert(1)</script>'); checks++;
    assert.equal(options.prepare, false); assert.equal(options.fetchSize, 100); assert.equal(options.readTimeout, 5000); checks++;
    await request({ query: 'SELECT * FROM users;' }, 200, token('admin'));
    assert.ok(captured.includes('username') && !captured.includes('password_hash')); checks++;
    const beforeUse = calls;
    await request({ query: 'USE audit_log_system;' }, 200, token('admin'));
    assert.equal(calls, beforeUse); checks++;
    const schema = await request({ query: 'DESCRIBE TABLE audit_logs;' }, 200, token('admin'));
    assert.ok(schema.data.text.includes('PRIMARY KEY ((service_name, log_date), log_time, log_id)')); checks++;
    assert.ok(schema.data.text.includes('log_time DESC, log_id ASC')); checks++;
    const tableList = await request({ query: 'DESCRIBE TABLES;' }, 200, token('admin'));
    assert.deepEqual(tableList.data.rows.map((row: any) => row.table_name), ['audit_logs', 'users']); checks++;
    mode = 'large'; const large = await cqlConsoleService.execute('SELECT * FROM audit_logs;');
    assert.equal(large.rows.length, 100); assert.equal(large.truncated, true); checks++;
    mode = 'empty'; const empty = await cqlConsoleService.execute('SELECT * FROM audit_logs;');
    assert.equal(empty.rows.length, 0); assert.equal(empty.truncated, false); checks++;
    mode = 'syntax'; await request({ query: 'SELECT * FROM audit_logs;' }, 400, token('admin'));
    mode = 'timeout'; await request({ query: 'SELECT * FROM audit_logs;' }, 503, token('admin'));
    console.log(`CQL console PASSED: ${checks} checks (RBAC, read-only statements, keyspace/table/column restrictions, schema, result limits, database errors).`);
  } finally {
    client.execute = saved.execute; userService.findByUsername = saved.find;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
