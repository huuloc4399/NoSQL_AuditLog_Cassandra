-- One-time removal of the two retired storefront tables.
-- Run explicitly on an older demo database; normal startup does not run this file.
-- Demo carts and orders now stay in the browser. Audit logs are preserved.
DROP TABLE IF EXISTS audit_log_system.shop_carts;
DROP TABLE IF EXISTS audit_log_system.shop_orders;
