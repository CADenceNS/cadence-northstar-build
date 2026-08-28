BEGIN;
ALTER TABLE case_intake_submission_links
  DROP CONSTRAINT IF EXISTS case_intake_submission_links_tenant_id_case_entity_type_ca_fkey;
ALTER TABLE case_intake_submission_links
  ADD CONSTRAINT case_intake_submission_links_case_document_fk
  FOREIGN KEY (tenant_id,case_entity_type,case_id)
  REFERENCES repository_documents(tenant_id,entity_type,entity_id)
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;
COMMIT;
