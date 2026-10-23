-- ============================================================================
-- SCRIPT 04: QUERY EXAMPLES (QUERY-FIRST DESIGN IN APACHE CASSANDRA)
-- Demonstrating partition key routing without ALLOW FILTERING
-- ============================================================================

USE audit_log_system;

-- ----------------------------------------------------------------------------
-- Q1: Query Service + Date
-- Uses main table: audit_logs
-- Partition Key: (service_name, log_date)
-- ----------------------------------------------------------------------------
SELECT service_name, log_date, log_time, log_id, level, action, user_id, ip_address, message
FROM audit_log_system.audit_logs
WHERE service_name = 'Payment'
  AND log_date = '2026-10-14'
LIMIT 50;

-- ----------------------------------------------------------------------------
-- Q2: Query Service + Date + Time Range
-- Uses main table: audit_logs
-- Partition Key: (service_name, log_date)
-- Clustering Column range slice: log_time >= ... AND log_time <= ...
-- ----------------------------------------------------------------------------
SELECT service_name, log_date, log_time, log_id, level, action, user_id, message
FROM audit_log_system.audit_logs
WHERE service_name = 'Auth'
  AND log_date = '2026-10-14'
  AND log_time >= '2026-10-14 08:00:00+0000'
  AND log_time <= '2026-10-14 18:00:00+0000';

-- ----------------------------------------------------------------------------
-- Q3: Query Service + Level (ERROR) + Date
-- Uses Query-First table: audit_logs_by_service_level
-- Partition Key: (service_name, level, log_date)
-- Extremely fast because Cassandra routes straight to single partition without filtering!
-- ----------------------------------------------------------------------------
SELECT service_name, level, log_date, log_time, log_id, action, user_id, message, details
FROM audit_log_system.audit_logs_by_service_level
WHERE service_name = 'Payment'
  AND level = 'ERROR'
  AND log_date = '2026-10-14';

-- ----------------------------------------------------------------------------
-- Q4: Query Service + Level + Date + Time Range
-- Uses Query-First table: audit_logs_by_service_level
-- Partition Key: (service_name, level, log_date)
-- Clustering Column: log_time range
-- ----------------------------------------------------------------------------
SELECT service_name, level, log_date, log_time, log_id, action, user_id, message
FROM audit_log_system.audit_logs_by_service_level
WHERE service_name = 'Payment'
  AND level = 'ERROR'
  AND log_date = '2026-10-14'
  AND log_time >= '2026-10-14 00:00:00+0000'
  AND log_time <= '2026-10-14 23:59:59+0000';

-- ----------------------------------------------------------------------------
-- Q5: Query INFO logs for User Service on specific date
-- ----------------------------------------------------------------------------
SELECT service_name, level, log_date, log_time, log_id, action, user_id, message
FROM audit_log_system.audit_logs_by_service_level
WHERE service_name = 'User'
  AND level = 'INFO'
  AND log_date = '2026-10-14'
LIMIT 20;

-- ----------------------------------------------------------------------------
-- Q6: Query WARN logs for Auth Service (e.g. LOGIN_FAILED)
-- ----------------------------------------------------------------------------
SELECT service_name, level, log_date, log_time, log_id, action, user_id, ip_address, message
FROM audit_log_system.audit_logs_by_service_level
WHERE service_name = 'Auth'
  AND level = 'WARN'
  AND log_date = '2026-10-14';

-- ----------------------------------------------------------------------------
-- Q7: Query Specific Log Detail by Primary Key
-- ----------------------------------------------------------------------------
-- Replace with an actual log_time and log_id:
-- SELECT * FROM audit_log_system.audit_logs
-- WHERE service_name = 'Order' AND log_date = '2026-10-14' AND log_time = '...' AND log_id = ...;

-- ----------------------------------------------------------------------------
-- Q8: Multi-Day Querying in Apache Cassandra
-- ARCHITECTURAL NOTE:
-- In Cassandra, `log_date` is a PARTITION KEY component: ((service_name, log_date)).
-- Because partition keys are hashed with Murmur3Partitioner, different dates
-- live on completely different physical nodes in the cluster ring.
--
-- Therefore, running:
--   SELECT * FROM audit_logs WHERE service_name = 'Auth' AND log_date >= '2026-10-10' AND log_date <= '2026-10-14';
-- will result in an InvalidQueryException unless ALLOW FILTERING is used.
--
-- In NoSQL Data Architecture, the correct solution is querying discrete partitions:
-- Either via CQL IN clause (for small number of dates):
-- ----------------------------------------------------------------------------
SELECT service_name, log_date, log_time, log_id, level, action, user_id, message
FROM audit_log_system.audit_logs
WHERE service_name = 'Auth'
  AND log_date IN ('2026-10-13', '2026-10-14')
LIMIT 100;

-- Or via Application-side parallel dispatch (preferred in high-load production
-- to prevent the coordinator node from becoming a scatter-gather bottleneck).

-- ----------------------------------------------------------------------------
-- Q9: Point Query by log_id (O(1) Direct Lookup)
-- Uses table: audit_logs_by_id
-- Partition Key: log_id uuid
-- ----------------------------------------------------------------------------
SELECT log_id, service_name, log_date, log_time, level, action, user_id, ip_address, message, details
FROM audit_log_system.audit_logs_by_id
WHERE log_id = 99999999-9999-9999-9999-999999999999;

