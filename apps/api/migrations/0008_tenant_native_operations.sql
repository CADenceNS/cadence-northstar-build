BEGIN;

-- CF-1A1: the original operational schema already carries tenant_id on every
-- operational table.  This migration makes the organization lifecycle and
-- membership state explicit without moving existing data between tenants.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS activation_state text,
  ADD COLUMN IF NOT EXISTS commercial_account_reference text,
  ADD COLUMN IF NOT EXISTS audit_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Historical NorthStar data was already keyed to the designated legacy tenant
-- by the original durable schema.  Ensure that tenant exists exactly once and
-- mark it as the active, migrated operational organization.  No operational
-- row is copied or reassigned by this migration.
INSERT INTO tenants(id,name,status,activation_state,commercial_account_reference,audit_metadata)
VALUES(
  '00000000-0000-0000-0000-000000000001',
  'Keramos Dental Laboratory',
  'ACTIVE',
  'ACTIVATED',
  'legacy-northstar-default',
  jsonb_build_object('migration','0008_tenant_native_operations','ownership','legacy-default')
)
ON CONFLICT (id) DO NOTHING;

UPDATE tenants
SET status=COALESCE(status,'ACTIVE'),
    activation_state=COALESCE(activation_state,'ACTIVATED'),
    audit_metadata=COALESCE(audit_metadata,'{}'::jsonb),
    updated_at=now()
WHERE status IS NULL OR activation_state IS NULL OR audit_metadata IS NULL;

ALTER TABLE tenants
  ALTER COLUMN status SET DEFAULT 'ACTIVE',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN activation_state SET DEFAULT 'ACTIVATED',
  ALTER COLUMN activation_state SET NOT NULL;

ALTER TABLE tenants
  ADD CONSTRAINT tenants_status_check CHECK (status IN ('TRIAL','ACTIVE','SUSPENDED','CANCELLED')),
  ADD CONSTRAINT tenants_activation_state_check CHECK (activation_state IN ('PENDING','ACTIVATED','DEACTIVATED'));

ALTER TABLE identity_memberships
  ADD COLUMN IF NOT EXISTS membership_status text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS platform_role text NOT NULL DEFAULT 'none';

ALTER TABLE identity_memberships
  ADD CONSTRAINT identity_memberships_status_check CHECK (membership_status IN ('ACTIVE','SUSPENDED','REVOKED')),
  ADD CONSTRAINT identity_memberships_platform_role_check CHECK (platform_role IN ('none','platform-admin'));

ALTER TABLE identity_sessions
  ADD COLUMN IF NOT EXISTS platform_role text NOT NULL DEFAULT 'none';

ALTER TABLE identity_sessions
  ADD CONSTRAINT identity_sessions_platform_role_check CHECK (platform_role IN ('none','platform-admin'));

CREATE TABLE tenant_migration_ledger (
  migration_key text PRIMARY KEY,
  legacy_tenant_id uuid NOT NULL REFERENCES tenants(id),
  ownership_rule text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO tenant_migration_ledger(migration_key,legacy_tenant_id,ownership_rule,metadata)
VALUES(
  '0008_tenant_native_operations',
  '00000000-0000-0000-0000-000000000001',
  'Existing rows retain their already-required tenant_id; pre-commercial NorthStar records belong only to the designated legacy tenant.',
  jsonb_build_object('idempotent','ON CONFLICT DO NOTHING','dataMovement','none')
)
ON CONFLICT (migration_key) DO NOTHING;

CREATE INDEX tenants_operational_access_idx
  ON tenants(id)
  WHERE status IN ('TRIAL','ACTIVE') AND activation_state='ACTIVATED' AND deleted_at IS NULL;

CREATE INDEX identity_memberships_operational_idx
  ON identity_memberships(tenant_id,user_id)
  WHERE membership_status='ACTIVE' AND platform_role='none';

COMMIT;
