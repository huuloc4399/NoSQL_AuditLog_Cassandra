-- ============================================================================
-- SCRIPT 03: SEED INITIAL SERVICES INTO CATALOGUE
-- Initial 4 Microservices: Auth, User, Order, Payment
-- All set to Active (status = true)
-- ============================================================================

USE audit_log_system;

-- 1. Auth Service
INSERT INTO audit_log_system.services (
    service_id, service_name, description, status, created_at, updated_at
) VALUES (
    11111111-1111-1111-1111-111111111111,
    'Auth',
    'Authentication, Session & OAuth2 Authorization Service',
    true,
    toTimestamp(now()),
    toTimestamp(now())
);

-- 2. User Service
INSERT INTO audit_log_system.services (
    service_id, service_name, description, status, created_at, updated_at
) VALUES (
    22222222-2222-2222-2222-222222222222,
    'User',
    'User Identity & Profile Administration Service',
    true,
    toTimestamp(now()),
    toTimestamp(now())
);

-- 3. Order Service
INSERT INTO audit_log_system.services (
    service_id, service_name, description, status, created_at, updated_at
) VALUES (
    33333333-3333-3333-3333-333333333333,
    'Order',
    'E-commerce Order Processing & Fulfillment Service',
    true,
    toTimestamp(now()),
    toTimestamp(now())
);

-- 4. Payment Service
INSERT INTO audit_log_system.services (
    service_id, service_name, description, status, created_at, updated_at
) VALUES (
    44444444-4444-4444-4444-444444444444,
    'Payment',
    'Financial Transactions & Payment Gateway Integration Service',
    true,
    toTimestamp(now()),
    toTimestamp(now())
);

-- Verification Query
SELECT service_id, service_name, status, description FROM audit_log_system.services;
