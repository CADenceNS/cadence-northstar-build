BEGIN;

-- F1 cases are durable tenant-scoped repository documents. Existing PP-1A
-- lines may still reference the older clinical_cases projection, so retain
-- both identities in a small tenant-owned reference registry rather than
-- discarding historical line items during the authority migration.
CREATE TABLE case_product_line_case_entities (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  case_entity_type text NOT NULL CHECK (case_entity_type IN ('case','clinical-case')),
  case_id text NOT NULL,
  PRIMARY KEY (tenant_id,case_entity_type,case_id)
);

INSERT INTO case_product_line_case_entities(tenant_id,case_entity_type,case_id)
SELECT tenant_id,'clinical-case',id::text FROM clinical_cases
ON CONFLICT DO NOTHING;

INSERT INTO case_product_line_case_entities(tenant_id,case_entity_type,case_id)
SELECT tenant_id,'case',entity_id FROM repository_documents
WHERE entity_type='case'
ON CONFLICT DO NOTHING;

CREATE FUNCTION sync_case_product_line_case_entity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.entity_type='case' THEN
    INSERT INTO case_product_line_case_entities(tenant_id,case_entity_type,case_id)
    VALUES(NEW.tenant_id,'case',NEW.entity_id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER repository_documents_case_product_line_entity
AFTER INSERT OR UPDATE OF tenant_id,entity_type,entity_id ON repository_documents
FOR EACH ROW EXECUTE FUNCTION sync_case_product_line_case_entity();

ALTER TABLE case_product_lines
  DROP CONSTRAINT IF EXISTS case_product_lines_tenant_id_case_id_fkey,
  ADD COLUMN IF NOT EXISTS case_entity_type text NOT NULL DEFAULT 'clinical-case',
  ADD COLUMN IF NOT EXISTS family_code_snapshot text NOT NULL DEFAULT '',
  ALTER COLUMN case_id TYPE text USING case_id::text;

ALTER TABLE case_product_lines
  ADD CONSTRAINT case_product_lines_case_document_tenant_fk
  FOREIGN KEY (tenant_id,case_entity_type,case_id)
  REFERENCES case_product_line_case_entities(tenant_id,case_entity_type,case_id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE case_product_tat_overrides
  DROP CONSTRAINT IF EXISTS case_product_tat_overrides_tenant_id_case_id_fkey,
  ADD COLUMN IF NOT EXISTS case_entity_type text NOT NULL DEFAULT 'clinical-case',
  ALTER COLUMN case_id TYPE text USING case_id::text;

ALTER TABLE case_product_tat_overrides
  ADD CONSTRAINT case_product_tat_overrides_case_document_tenant_fk
  FOREIGN KEY (tenant_id,case_entity_type,case_id)
  REFERENCES case_product_line_case_entities(tenant_id,case_entity_type,case_id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS case_product_lines_case_document_idx
  ON case_product_lines(tenant_id,case_entity_type,case_id,line_number);

COMMIT;
