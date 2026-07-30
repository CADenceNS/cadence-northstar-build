BEGIN;

CREATE TABLE IF NOT EXISTS identity_credentials (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  password_hash text NOT NULL,
  email_verified_at timestamptz,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS identity_memberships (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  role text NOT NULL,
  location_ids text[] NOT NULL DEFAULT '{}',
  practice_ids text[] NOT NULL DEFAULT '{}',
  administrative_override boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS identity_sessions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  csrf_hash text NOT NULL,
  role text NOT NULL,
  location_ids text[] NOT NULL DEFAULT '{}',
  practice_ids text[] NOT NULL DEFAULT '{}',
  administrative_override boolean NOT NULL DEFAULT false,
  ip_address inet,
  user_agent text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  idle_expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_reason text,
  rotated_from uuid REFERENCES identity_sessions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS identity_sessions_user_active_idx
  ON identity_sessions (tenant_id, user_id, last_seen_at DESC)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS identity_sessions_expiry_idx
  ON identity_sessions (idle_expires_at, absolute_expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS identity_tokens (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('password-reset','email-verification','mfa-enrollment','oidc-link')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS identity_tokens_user_idx ON identity_tokens (tenant_id, user_id, purpose, created_at DESC);

COMMIT;
