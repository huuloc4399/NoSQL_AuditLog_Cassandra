-- ============================================================================
-- SCRIPT 02: CREATE TABLES (QUERY-FIRST DATA MODELING IN CASSANDRA)
-- ============================================================================

USE audit_log_system;

-- ----------------------------------------------------------------------------
-- Table 1: audit_logs (Main table for querying by Service + Date + Time Range)
-- Partition Key: (service_name, log_date) - Groups logs by service per calendar date
-- Clustering Columns: log_time DESC, log_id ASC - Chronological order newest first
-- log_id ensures uniqueness when multiple logs share exact millisecond timestamp
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log_system.audit_logs (
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
) WITH CLUSTERING ORDER BY (log_time DESC, log_id ASC)
  AND comment = 'Audit logs partitioned by service and calendar date';

-- ----------------------------------------------------------------------------
-- Table 2: audit_logs_by_service_level (Query-First table for Service + Level + Date)
-- Partition Key: (service_name, level, log_date) - Direct lookup without ALLOW FILTERING
-- Clustering Columns: log_time DESC, log_id ASC - Chronological order newest first
-- Supports high-efficiency queries like: "Show all ERROR logs in Payment service today"
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log_system.audit_logs_by_service_level (
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
) WITH CLUSTERING ORDER BY (log_time DESC, log_id ASC)
  AND comment = 'Audit logs partitioned by service, level, and calendar date';

-- ----------------------------------------------------------------------------
-- Table 3: services (Master / Catalogue Table for System Services)
-- Partition Key: service_id uuid
-- Secondary Index: service_name for fast uniqueness verification and lookup
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log_system.services (
    service_id uuid,
    service_name text,
    description text,
    status boolean,
    created_at timestamp,
    updated_at timestamp,
    PRIMARY KEY (service_id)
) WITH comment = 'Catalog of registered microservices for audit tracking';

-- Secondary index on service_name for fast lookup and deduplication check
CREATE INDEX IF NOT EXISTS idx_services_name ON audit_log_system.services (service_name);

-- ----------------------------------------------------------------------------
-- Table 4: audit_logs_by_id (Query-First table for direct log lookup by log_id)
-- Partition Key: log_id uuid - Direct O(1) point lookup without ALLOW FILTERING
-- Supports GET /api/logs/:id endpoint efficiently
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log_system.audit_logs_by_id (
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
) WITH comment = 'Audit logs partitioned by unique log_id for direct O(1) point lookups';
