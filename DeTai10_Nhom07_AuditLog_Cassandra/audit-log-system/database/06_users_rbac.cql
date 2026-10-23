-- ============================================================================
-- SCRIPT 06: USERS & ROLE-BASED ACCESS CONTROL (RBAC) SCHEMA
-- Stores application user credentials (bcrypt hash) and system roles
-- Roles: ADMIN, USER
-- Status: ACTIVE, INACTIVE
-- ============================================================================

USE audit_log_system;

-- ----------------------------------------------------------------------------
-- Table: users (Application Users with RBAC)
-- Partition Key: username text (Unique username lookups for authentication)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log_system.users (
    user_id uuid,
    username text,
    password_hash text,
    full_name text,
    email text,
    role text,
    status text,
    created_at timestamp,
    updated_at timestamp,
    PRIMARY KEY (username)
) WITH comment = 'Application user accounts with bcrypt hashed passwords and RBAC roles';

-- Secondary Index for lookup by user_id
CREATE INDEX IF NOT EXISTS idx_users_id ON audit_log_system.users (user_id);

-- Initial Demo Users (passwords hashed with bcrypt cost factor 10):
-- 1. admin / admin123 -> $2a$10$wT6vB/o7l8E04X9HhM39eO70W7L1VpTj0k5Gj6M3zQ5bL5vG5hLzK (or seeded via backend)
