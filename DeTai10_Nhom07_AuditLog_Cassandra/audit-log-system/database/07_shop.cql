USE audit_log_system;

-- Each account has one persistent demo cart.
CREATE TABLE IF NOT EXISTS shop_carts (
  user_id uuid PRIMARY KEY,
  payload text
);

-- Owner-scoped lookup and order history, with no ALLOW FILTERING.
-- JSON snapshots hold product prices, shipping, state and payment attempts.
-- This small educational catalog does not implement warehouse inventory.
CREATE TABLE IF NOT EXISTS shop_orders (
  user_id uuid,
  order_id uuid,
  payload text,
  PRIMARY KEY ((user_id), order_id)
);
