import { getCassandraClient, cassandra, connectCassandra, closeCassandra } from '../src/config/cassandra.js';
import { auditLogService } from '../src/services/auditLogService.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTtlDemo() {
  console.log(`
======================================================================
      APACHE CASSANDRA NATIVE TIME-TO-LIVE (30s) LIVE DEMO
======================================================================
Keyspace:   audit_log_system
Target TTL: 30 seconds
Purpose:    Demonstrate row-level automated expiration without DELETE
======================================================================
`);

  let connected = false;
  try {
    connected = await connectCassandra();
  } catch (err: any) {
    connected = false;
  }

  if (!connected) {
    console.warn(`\n[CASSANDRA OFFLINE NOTICE]`);
    console.warn(`Could not connect to Cassandra cluster at 127.0.0.1:9042.`);
    console.warn(`Please ensure Cassandra container is running:`);
    console.warn(`  1. docker compose up -d`);
    console.warn(`  2. docker exec -it cassandra_audit_node nodetool status`);
    console.warn(`  3. npm run demo:ttl\n`);
    process.exit(0);
  }

  const client = getCassandraClient();
  const demoUuid = cassandra.types.Uuid.random().toString();
  const ttlSeconds = 30;

  console.log(`\n[STEP 1] Inserting audit log into Cassandra with USING TTL ${ttlSeconds}...`);
  const record = await auditLogService.createLog({
    service_name: 'Auth',
    level: 'WARN',
    action: 'LOGIN_FAILED',
    message: `Cassandra TTL Live Demo - Auto-expires in ${ttlSeconds}s`,
    user_id: 'ttl_demo_evaluator',
    ip_address: '192.168.1.100',
    details: {
      demo_name: 'Cassandra Native TTL Defense Demo',
      ttl_seconds: ttlSeconds,
      timestamp: new Date().toISOString(),
    },
    ttl: ttlSeconds,
    log_id: demoUuid,
  });

  console.log(`✔ INSERT successful across query-first tables:`);
  console.log(`  - Log ID:      ${record.log_id}`);
  console.log(`  - Service:     ${record.service_name}`);
  console.log(`  - Level:       ${record.level}`);
  console.log(`  - Action:      ${record.action}`);
  console.log(`  - Configured:  USING TTL ${ttlSeconds} seconds\n`);

  console.log(`[STEP 2] Immediate verification query with TTL(message)...`);
  const statusStep2 = await auditLogService.getTtlStatus(demoUuid);
  if (!statusStep2.found) {
    console.error(`❌ Record unexpectedly missing immediately after insert!`);
    process.exit(1);
  }
  console.log(`✔ Record FOUND immediately in Cassandra:`);
  console.log(`  - Cassandra TTL(message): ${statusStep2.remaining_ttl}s remaining before purge`);
  console.log(`  - Status: ACTIVE IN CASSANDRA MEMTABLE / SSTABLE\n`);

  console.log(`[STEP 3] Real-time Cassandra polling (every 5 seconds):`);
  console.log(`----------------------------------------------------------------------`);
  console.log(` Elapsed   | Cassandra TTL(message) | Status`);
  console.log(`----------------------------------------------------------------------`);

  for (let elapsed = 5; elapsed <= 25; elapsed += 5) {
    await sleep(5000);
    const pollStatus = await auditLogService.getTtlStatus(demoUuid);
    const ttlStr = pollStatus.found ? `${pollStatus.remaining_ttl}s remaining` : 'EXPIRED';
    const statusStr = pollStatus.found ? 'ACTIVE (Row exists)' : 'TOMBSTONED';
    console.log(` T+${String(elapsed).padStart(2, ' ')}s     | ${ttlStr.padEnd(22, ' ')} | ${statusStr}`);
  }

  console.log(`----------------------------------------------------------------------`);
  console.log(`Waiting remaining 6 seconds for 30s TTL window to expire...`);
  await sleep(7000); // 25s + 7s = 32s (> 30s)

  console.log(`\n[STEP 4] Querying Cassandra after 32 seconds elapsed...`);
  const finalStatus = await auditLogService.getTtlStatus(demoUuid);

  if (finalStatus.found) {
    console.warn(`⚠ Record still found (remaining: ${finalStatus.remaining_ttl}s). Waiting 3 more seconds...`);
    await sleep(3000);
    const retryStatus = await auditLogService.getTtlStatus(demoUuid);
    if (!retryStatus.found) {
      console.log(`✔ Query: SELECT * FROM audit_logs_by_id WHERE log_id = ${demoUuid};`);
      console.log(`✔ Result: 0 ROWS RETURNED!`);
      console.log(`✔ Record has been completely PURGED by Apache Cassandra TTL engine!`);
    } else {
      console.log(`Final remaining TTL: ${retryStatus.remaining_ttl}s`);
    }
  } else {
    console.log(`✔ Query: SELECT * FROM audit_logs_by_id WHERE log_id = ${demoUuid};`);
    console.log(`✔ Result: 0 ROWS RETURNED!`);
    console.log(`✔ Status: EXPIRED & AUTOMATICALLY DELETED BY APACHE CASSANDRA!`);
  }

  console.log(`
======================================================================
              ARCHITECTURAL EXPLANATION FOR DEFENSE
======================================================================
1. Zero Cron Jobs:
   Unlike relational databases (MySQL/PostgreSQL) where a background worker
   or DELETE query is required, Cassandra handles TTL natively at the cell
   and row level.

2. Zero Application Delete Pressure:
   The application never sends a DELETE query. Cassandra calculates expiration
   on read queries based on server timestamp + TTL.

3. Compaction Lifecycle:
   Expired rows are skipped during read queries and physically purged from disk
   during standard Cassandra SSTable Compaction.

4. Multi-Table Parity:
   The same TTL is applied to all query-first tables (audit_logs, 
   audit_logs_by_service_level, audit_logs_by_id) ensuring data consistency.
======================================================================
`);

  process.exit(0);
}

runTtlDemo().catch((err) => {
  console.error('[TTL Demo Error]', err);
  process.exit(1);
});
