BEGIN;

-- CF-1A3A: commercial activation is state on the existing laboratory tenant;
-- credentials are one-time verifiers, never user authentication credentials.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS commercial_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS commercial_suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS commercial_cancelled_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_commercial_account_reference_idx
  ON tenants(commercial_account_reference)
  WHERE commercial_account_reference IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE tenant_activation_credentials (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  secret_hash text NOT NULL,
  issued_by text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  activated_at timestamptz,
  activated_by text,
  revoked_at timestamptz,
  revoked_by text,
  revocation_reason text,
  supersedes_credential_id uuid REFERENCES tenant_activation_credentials(id),
  replaced_by_credential_id uuid REFERENCES tenant_activation_credentials(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (expires_at > issued_at),
  CHECK ((activated_at IS NULL) = (activated_by IS NULL)),
  CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
);

CREATE INDEX tenant_activation_credentials_active_idx
  ON tenant_activation_credentials(tenant_id,expires_at)
  WHERE activated_at IS NULL AND revoked_at IS NULL;
CREATE INDEX tenant_activation_credentials_history_idx
  ON tenant_activation_credentials(tenant_id,issued_at DESC);

-- The historical NorthStar organization was already activated before
-- commercial licensing existed.  This is a deterministic provenance marker,
-- not a credential and not a runtime entitlement fallback.
UPDATE tenants
SET commercial_activated_at=COALESCE(commercial_activated_at,created_at)
WHERE id='00000000-0000-0000-0000-000000000001'
  AND status IN ('TRIAL','ACTIVE') AND activation_state='ACTIVATED';

COMMIT;
