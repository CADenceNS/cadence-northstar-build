BEGIN;

DROP INDEX IF EXISTS identity_memberships_operational_idx;
DROP INDEX IF EXISTS tenants_operational_access_idx;
DROP TABLE IF EXISTS tenant_migration_ledger;

ALTER TABLE identity_sessions DROP CONSTRAINT IF EXISTS identity_sessions_platform_role_check;
ALTER TABLE identity_sessions DROP COLUMN IF EXISTS platform_role;

ALTER TABLE identity_memberships DROP CONSTRAINT IF EXISTS identity_memberships_platform_role_check;
ALTER TABLE identity_memberships DROP CONSTRAINT IF EXISTS identity_memberships_status_check;
ALTER TABLE identity_memberships DROP COLUMN IF EXISTS platform_role;
ALTER TABLE identity_memberships DROP COLUMN IF EXISTS membership_status;

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_activation_state_check;
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants DROP COLUMN IF EXISTS audit_metadata;
ALTER TABLE tenants DROP COLUMN IF EXISTS commercial_account_reference;
ALTER TABLE tenants DROP COLUMN IF EXISTS activation_state;
ALTER TABLE tenants DROP COLUMN IF EXISTS status;

COMMIT;
