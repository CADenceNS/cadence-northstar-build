BEGIN;

CREATE TABLE repository_documents (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  payload jsonb NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (tenant_id, entity_type, entity_id)
);

CREATE INDEX idx_repository_documents_active
  ON repository_documents (tenant_id, entity_type, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_repository_documents_payload
  ON repository_documents USING gin (payload jsonb_path_ops);

CREATE TABLE object_payloads (
  object_key text PRIMARY KEY,
  bytes bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
