BEGIN;
DROP TABLE IF EXISTS pricing_schedule_items;
DROP TABLE IF EXISTS pricing_schedules;
DROP TABLE IF EXISTS tenant_routing_defaults;
DROP TABLE IF EXISTS practice_routing_profiles;
ALTER TABLE product_catalog
  ADD COLUMN IF NOT EXISTS default_customer_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS promotional_price numeric(12,2);
COMMIT;
