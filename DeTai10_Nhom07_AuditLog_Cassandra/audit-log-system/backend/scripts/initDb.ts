import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cassandra from 'cassandra-driver';
import { env } from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runCqlFile(client: cassandra.Client, filePath: string): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Split on semicolon, ignoring comments and blank lines
  const statements = content
    .split(';')
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));

  for (const statement of statements) {
    const cleanStmt = statement
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .trim();

    if (!cleanStmt) continue;
    if (cleanStmt.toUpperCase().startsWith('USE ')) continue; // driver manages keyspace
    if (cleanStmt.toUpperCase().startsWith('DESCRIBE ')) continue;

    try {
      await client.execute(cleanStmt);
      console.log(`  [OK] Executed CQL statement: ${cleanStmt.substring(0, 50).replace(/\n/g, ' ')}...`);
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        console.log(`  [EXISTS] Object already exists: ${cleanStmt.substring(0, 50).replace(/\n/g, ' ')}...`);
      } else {
        console.warn(`  [WARN] Statement warning/error: ${err.message}`);
      }
    }
  }
}

async function initDb() {
  console.log('===========================================================');
  console.log('   INITIALIZING APACHE CASSANDRA DATABASE SCHEMA          ');
  console.log(`   Keyspace: ${env.CASSANDRA_KEYSPACE}                    `);
  console.log(`   Contact Points: ${env.CASSANDRA_CONTACT_POINTS.join(', ')}`);
  console.log('===========================================================');

  // Step 1: Connect to system cluster without specific keyspace
  const systemClient = new cassandra.Client({
    contactPoints: env.CASSANDRA_CONTACT_POINTS,
    protocolOptions: { port: env.CASSANDRA_PORT },
    localDataCenter: env.CASSANDRA_LOCAL_DATA_CENTER,
  });

  try {
    await systemClient.connect();
    console.log('[Cassandra] Connected to cluster.');

    const dbDir = path.resolve(__dirname, '../../database');

    // Run 01_keyspace.cql
    const keyspacePath = path.join(dbDir, '01_keyspace.cql');
    if (fs.existsSync(keyspacePath)) {
      console.log(`\nExecuting 01_keyspace.cql...`);
      await runCqlFile(systemClient, keyspacePath);
    }
  } finally {
    await systemClient.shutdown().catch(() => {});
  }

  // Step 2: Connect directly to the created keyspace
  const keyspaceClient = new cassandra.Client({
    contactPoints: env.CASSANDRA_CONTACT_POINTS,
    protocolOptions: { port: env.CASSANDRA_PORT },
    localDataCenter: env.CASSANDRA_LOCAL_DATA_CENTER,
    keyspace: env.CASSANDRA_KEYSPACE,
  });

  try {
    await keyspaceClient.connect();
    console.log(`[Cassandra] Connected to keyspace '${env.CASSANDRA_KEYSPACE}'.`);

    const dbDir = path.resolve(__dirname, '../../database');

    // Run 02_tables.cql
    const tablesPath = path.join(dbDir, '02_tables.cql');
    if (fs.existsSync(tablesPath)) {
      console.log(`\nExecuting 02_tables.cql...`);
      await runCqlFile(keyspaceClient, tablesPath);
    }

    // Run 03_seed_services.cql
    const seedPath = path.join(dbDir, '03_seed_services.cql');
    if (fs.existsSync(seedPath)) {
      console.log(`\nExecuting 03_seed_services.cql...`);
      await runCqlFile(keyspaceClient, seedPath);
    }

    console.log('\n===========================================================');
    console.log('   DATABASE INITIALIZATION COMPLETED SUCCESSFULLY!        ');
    console.log('===========================================================');
  } catch (err: any) {
    console.error('[Error] Database initialization failed:', err.message);
    process.exit(1);
  } finally {
    await keyspaceClient.shutdown().catch(() => {});
  }
}

initDb();
