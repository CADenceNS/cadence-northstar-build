BEGIN;

-- A populated F2 Case Builder record cannot be safely recast into the retired
-- clinical_cases projection. Stop rather than silently losing immutable lines.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM case_product_lines WHERE case_entity_type='case')
    OR EXISTS (SELECT 1 FROM case_product_tat_overrides WHERE case_entity_type='case') THEN
    RAISE EXCEPTION 'Cannot roll back 0014 while Case Builder repository case records exist.';
  END IF;
END $$;

ALTER TABLE case_product_lines
  DROP CONSTRAINT IF EXISTS case_product_lines_case_document_tenant_fk,
  DROP COLUMN IF EXISTS case_entity_type,
  DROP COLUMN IF EXISTS family_code_snapshot,
  ALTER COLUMN case_id TYPE uuid USING case_id::uuid;

ALTER TABLE case_product_lines
  ADD CONSTRAINT case_product_lines_tenant_id_case_id_fkey
  FOREIGN KEY (tenant_id,case_id) REFERENCES clinical_cases(tenant_id,id);

ALTER TABLE case_product_tat_overrides
  DROP CONSTRAINT IF EXISTS case_product_tat_overrides_case_document_tenant_fk,
  DROP COLUMN IF EXISTS case_entity_type,
  ALTER COLUMN case_id TYPE uuid USING case_id::uuid;

ALTER TABLE case_product_tat_overrides
  ADD CONSTRAINT case_product_tat_overrides_tenant_id_case_id_fkey
  FOREIGN KEY (tenant_id,case_id) REFERENCES clinical_cases(tenant_id,id);

DROP INDEX IF EXISTS case_product_lines_case_document_idx;
DROP TRIGGER IF EXISTS repository_documents_case_product_line_entity ON repository_documents;
DROP FUNCTION IF EXISTS sync_case_product_line_case_entity();
DROP TABLE IF EXISTS case_product_line_case_entities;

COMMIT;
