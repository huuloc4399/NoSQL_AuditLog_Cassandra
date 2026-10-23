-- ============================================================================
-- SCRIPT 01: CREATE KEYSPACE FOR AUDIT LOG MONITORING SYSTEM
-- Database: Apache Cassandra (Wide Column / Column Family NoSQL Database)
-- Replication Strategy: SimpleStrategy (Single Node / Dev & Demo Environment)
-- Replication Factor: 1
-- ============================================================================

CREATE KEYSPACE IF NOT EXISTS audit_log_system
WITH replication = {
    'class': 'SimpleStrategy',
    'replication_factor': 1
} AND durable_writes = true;

DESCRIBE KEYSPACE audit_log_system;
