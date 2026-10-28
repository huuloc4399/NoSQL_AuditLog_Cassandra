import { getCassandraClient, closeCassandra } from '../src/config/cassandra.js';
import { env } from '../src/config/env.js';

async function main() {
  if (!/^[a-z][a-z0-9_]*$/.test(env.CASSANDRA_KEYSPACE)) throw Error('Invalid keyspace name.');
  const client = getCassandraClient();
  await client.connect();
  // Explicit maintenance only: never called from application startup.
  for (const table of ['shop_carts', 'shop_orders']) {
    await client.execute(`DROP TABLE IF EXISTS ${env.CASSANDRA_KEYSPACE}.${table}`);
    console.log(`Removed retired table: ${table}`);
  }
  const rows = await client.execute('SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?', [env.CASSANDRA_KEYSPACE], { prepare: true });
  const remaining = rows.rows.map(row => row.table_name);
  if (remaining.some(table => table === 'shop_carts' || table === 'shop_orders')) throw Error('Legacy shop tables remain.');
  console.log('Storefront table cleanup complete. Audit and account tables preserved.');
}
main().catch(error => { console.error('Storefront table cleanup failed:', error.message); process.exitCode = 1; }).finally(closeCassandra);
