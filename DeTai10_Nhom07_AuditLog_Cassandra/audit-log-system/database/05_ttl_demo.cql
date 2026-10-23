-- ============================================================================
-- SCRIPT 05: DEMONSTRATION OF CASSANDRA NATIVE TTL (TIME-TO-LIVE)
-- Shows automated lifecycle data expiration without cron job or DELETE statements.
-- In Cassandra, TTL is specified in SECONDS at insert time.
--
-- How to run this in Docker:
--   docker exec -i cassandra_audit_node cqlsh -u cassandra -p cassandra < database/05_ttl_demo.cql
-- Or run the automated Node.js interactive countdown demo:
--   npm run demo:ttl
-- ============================================================================

USE audit_log_system;

-- ----------------------------------------------------------------------------
-- STEP 1: Insert temporary audit record with TTL = 30 seconds
-- Using identical log_id across all query-first tables per Query-First specification
-- ----------------------------------------------------------------------------
INSERT INTO audit_log_system.audit_logs (
    service_name,
    log_date,
    log_time,
    log_id,
    level,
    action,
    user_id,
    ip_address,
    message,
    details
) VALUES (
    'Auth',
    toDate(now()),
    toTimestamp(now()),
    11111111-2222-3333-4444-555555555555,
    'WARN',
    'LOGIN_FAILED',
    'usr_ttl_demo',
    '192.168.1.99',
    'Temporary TTL Demo Log - Auto-expires in 30 seconds',
    '{"reason": "Cassandra TTL Defense Demo", "ttl_seconds": 30}'
) USING TTL 30;

-- Also insert into audit_logs_by_service_level with same log_id and TTL
INSERT INTO audit_log_system.audit_logs_by_service_level (
    service_name,
    level,
    log_date,
    log_time,
    log_id,
    action,
    user_id,
    ip_address,
    message,
    details
) VALUES (
    'Auth',
    'WARN',
    toDate(now()),
    toTimestamp(now()),
    11111111-2222-3333-4444-555555555555,
    'LOGIN_FAILED',
    'usr_ttl_demo',
    '192.168.1.99',
    'Temporary TTL Demo Log - Auto-expires in 30 seconds',
    '{"reason": "Cassandra TTL Defense Demo", "ttl_seconds": 30}'
) USING TTL 30;

-- Also insert into audit_logs_by_id with same log_id and TTL
INSERT INTO audit_log_system.audit_logs_by_id (
    log_id,
    service_name,
    log_date,
    log_time,
    level,
    action,
    user_id,
    ip_address,
    message,
    details
) VALUES (
    11111111-2222-3333-4444-555555555555,
    'Auth',
    toDate(now()),
    toTimestamp(now()),
    'WARN',
    'LOGIN_FAILED',
    'usr_ttl_demo',
    '192.168.1.99',
    'Temporary TTL Demo Log - Auto-expires in 30 seconds',
    '{"reason": "Cassandra TTL Defense Demo", "ttl_seconds": 30}'
) USING TTL 30;

-- ----------------------------------------------------------------------------
-- STEP 2: Verify record existence and inspect remaining TTL (Seconds remaining)
-- In Cassandra CQL, the TTL() function can be called on any non-primary key column.
-- Here TTL(message) returns the exact number of seconds remaining before expiration.
-- ----------------------------------------------------------------------------
SELECT 
    log_id,
    service_name, 
    log_date, 
    log_time, 
    level, 
    action, 
    message, 
    TTL(message) AS remaining_seconds_ttl
FROM audit_log_system.audit_logs_by_id
WHERE log_id = 11111111-2222-3333-4444-555555555555;

-- ----------------------------------------------------------------------------
-- STEP 3: Wait 31+ seconds and run the same query again.
-- RESULT:
-- (0 rows)
-- The row is automatically removed by Cassandra without issuing any DELETE query!
-- ----------------------------------------------------------------------------
SELECT 
    log_id,
    service_name, 
    log_date, 
    log_time, 
    level, 
    action, 
    message
FROM audit_log_system.audit_logs_by_id
WHERE log_id = 11111111-2222-3333-4444-555555555555;
