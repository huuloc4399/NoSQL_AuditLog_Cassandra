import cassandra from 'cassandra-driver';
import { env } from './env.js';

let client: cassandra.Client | null = null;
let isConnected = false;

/**
 * Initialize and get the Cassandra Client singleton
 */
export function getCassandraClient(): cassandra.Client {
  if (!client) {
    client = new cassandra.Client({
      contactPoints: env.CASSANDRA_CONTACT_POINTS,
      protocolOptions: {
        port: env.CASSANDRA_PORT,
      },
      localDataCenter: env.CASSANDRA_LOCAL_DATA_CENTER,
      keyspace: env.CASSANDRA_KEYSPACE,
      socketOptions: {
        connectTimeout: 5000,
        readTimeout: 12000,
      },
      pooling: {
        coreConnectionsPerHost: {
          [cassandra.types.distance.local]: 2,
          [cassandra.types.distance.remote]: 1,
        },
      },
      policies: {
        reconnection: new cassandra.policies.reconnection.ExponentialReconnectionPolicy(500, 10000),
        loadBalancing: new cassandra.policies.loadBalancing.TokenAwarePolicy(
          new cassandra.policies.loadBalancing.DCAwareRoundRobinPolicy(env.CASSANDRA_LOCAL_DATA_CENTER)
        ),
      },
      queryOptions: {
        consistency: cassandra.types.consistencies.one,
        prepare: true,
      },
    });

    client.on('log', (level, className, message) => {
      if (level === 'warning' || level === 'error') {
        console.warn(`[Cassandra ${level.toUpperCase()}] ${className}: ${message}`);
      }
    });

    client.on('error', (err) => {
      console.error(`[Cassandra Client Event Error]: ${err.message}`);
      isConnected = false;
    });
  }

  return client;
}

/**
 * Bootstrap keyspace and tables if missing
 */
async function ensureKeyspaceAndTables(): Promise<void> {
  const bootstrapClient = new cassandra.Client({
    contactPoints: env.CASSANDRA_CONTACT_POINTS,
    protocolOptions: { port: env.CASSANDRA_PORT },
    localDataCenter: env.CASSANDRA_LOCAL_DATA_CENTER,
    socketOptions: { connectTimeout: 5000, readTimeout: 12000 },
  });

  try {
    await bootstrapClient.connect();
    // 1. Create Keyspace
    await bootstrapClient.execute(`
      CREATE KEYSPACE IF NOT EXISTS ${env.CASSANDRA_KEYSPACE}
      WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}
      AND durable_writes = true;
    `);

    // 2. Create audit_logs table
    await bootstrapClient.execute(`
      CREATE TABLE IF NOT EXISTS ${env.CASSANDRA_KEYSPACE}.audit_logs (
        service_name text,
        log_date date,
        log_time timestamp,
        log_id uuid,
        level text,
        action text,
        user_id text,
        ip_address text,
        message text,
        details text,
        PRIMARY KEY ((service_name, log_date), log_time, log_id)
      ) WITH CLUSTERING ORDER BY (log_time DESC, log_id ASC);
    `);

    // 3. Create audit_logs_by_service_level table
    await bootstrapClient.execute(`
      CREATE TABLE IF NOT EXISTS ${env.CASSANDRA_KEYSPACE}.audit_logs_by_service_level (
        service_name text,
        level text,
        log_date date,
        log_time timestamp,
        log_id uuid,
        action text,
        user_id text,
        ip_address text,
        message text,
        details text,
        PRIMARY KEY ((service_name, level, log_date), log_time, log_id)
      ) WITH CLUSTERING ORDER BY (log_time DESC, log_id ASC);
    `);

    // 4. Create services catalogue table
    await bootstrapClient.execute(`
      CREATE TABLE IF NOT EXISTS ${env.CASSANDRA_KEYSPACE}.services (
        service_id uuid,
        service_name text,
        description text,
        status boolean,
        created_at timestamp,
        updated_at timestamp,
        PRIMARY KEY (service_id)
      );
    `);

    await bootstrapClient.execute(`
      CREATE INDEX IF NOT EXISTS idx_services_name ON ${env.CASSANDRA_KEYSPACE}.services (service_name);
    `);

    // 5. Create audit_logs_by_id table (Query-First for GET /api/logs/:id)
    await bootstrapClient.execute(`
      CREATE TABLE IF NOT EXISTS ${env.CASSANDRA_KEYSPACE}.audit_logs_by_id (
        log_id uuid,
        service_name text,
        log_date date,
        log_time timestamp,
        level text,
        action text,
        user_id text,
        ip_address text,
        message text,
        details text,
        PRIMARY KEY (log_id)
      );
    `);
  } finally {
    await bootstrapClient.shutdown().catch(() => {});
  }
}

/**
 * Connect to Cassandra cluster with health check and auto-bootstrap
 */
export async function connectCassandra(): Promise<boolean> {
  try {
    const c = getCassandraClient();
    await c.connect();
    isConnected = true;
    console.log(`[Cassandra] Connected successfully to keyspace '${env.CASSANDRA_KEYSPACE}' at ${env.CASSANDRA_CONTACT_POINTS.join(', ')}`);
    return true;
  } catch (error: any) {
    if (error.message?.includes('does not exist') || error.name === 'InvalidQueryException') {
      try {
        console.log(`[Cassandra] Keyspace or schema missing. Bootstrapping schema...`);
        await ensureKeyspaceAndTables();
        const c = getCassandraClient();
        await c.connect();
        isConnected = true;
        console.log(`[Cassandra] Schema bootstrapped and connected successfully to '${env.CASSANDRA_KEYSPACE}'`);
        return true;
      } catch (bootErr: any) {
        console.error(`[Cassandra Bootstrap Failed]: ${bootErr.message}`);
      }
    }
    isConnected = false;
    console.error(`[Cassandra Connection Error]: ${error.message}`);
    return false;
  }
}

/**
 * Check if Cassandra connection is live
 */
export async function isCassandraHealthy(): Promise<{ healthy: boolean; details?: any; error?: string }> {
  try {
    const c = getCassandraClient();
    const result = await c.execute('SELECT cluster_name, release_version, data_center, rack FROM system.local');
    const row = result.first();
    return {
      healthy: true,
      details: {
        cluster_name: row?.cluster_name,
        release_version: row?.release_version,
        data_center: row?.data_center,
        rack: row?.rack,
      },
    };
  } catch (err: any) {
    return {
      healthy: false,
      error: err.message || 'Database unavailable',
    };
  }
}

/**
 * Graceful disconnect
 */
export async function closeCassandra(): Promise<void> {
  if (client) {
    try {
      await client.shutdown();
      isConnected = false;
      client = null;
      console.log('[Cassandra] Disconnected cleanly.');
    } catch (err: any) {
      console.error('[Cassandra] Error during shutdown:', err.message);
    }
  }
}

export { cassandra };
