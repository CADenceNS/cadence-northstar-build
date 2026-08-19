BEGIN;

DROP INDEX IF EXISTS tenant_activation_credentials_history_idx;
DROP INDEX IF EXISTS tenant_activation_credentials_active_idx;
DROP TABLE IF EXISTS tenant_activation_credentials;
DROP INDEX IF EXISTS tenants_commercial_account_reference_idx;
ALTER TABLE tenants
  DROP COLUMN IF EXISTS commercial_cancelled_at,
  DROP COLUMN IF EXISTS commercial_suspended_at,
  DROP COLUMN IF EXISTS commercial_activated_at;

COMMIT;
