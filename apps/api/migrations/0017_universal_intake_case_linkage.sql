BEGIN;

-- Submission channels describe how material arrived; the Case profile remains
-- the separate operational DIGITAL / PHYSICAL / HYBRID classification.
ALTER TABLE intake_submissions ADD CONSTRAINT intake_submissions_tenant_id_id_unique UNIQUE (tenant_id,id);
ALTER TABLE case_intake_profiles DROP CONSTRAINT case_intake_profiles_intake_method_check;
ALTER TABLE case_intake_profiles ADD CONSTRAINT case_intake_profiles_intake_method_check CHECK (intake_method IN ('DIGITAL','PHYSICAL','HYBRID','UNKNOWN'));
UPDATE case_intake_profiles SET intake_method='UNKNOWN',updated_at=now() WHERE created_by='migration-0016' AND intake_method='HYBRID';

CREATE TABLE case_intake_submission_links (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  case_entity_type text NOT NULL DEFAULT 'case' CHECK (case_entity_type='case'),
  case_id text NOT NULL,
  submission_id uuid NOT NULL,
  linked_by text NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,case_id,submission_id),
  UNIQUE (tenant_id,submission_id),
  FOREIGN KEY (tenant_id,case_entity_type,case_id) REFERENCES repository_documents(tenant_id,entity_type,entity_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (tenant_id,submission_id) REFERENCES intake_submissions(tenant_id,id) ON DELETE RESTRICT
);
CREATE INDEX case_intake_submission_links_case_idx ON case_intake_submission_links(tenant_id,case_id,linked_at);

ALTER TABLE case_files ADD COLUMN intake_submission_id uuid;
ALTER TABLE case_files ADD CONSTRAINT case_files_intake_submission_fk FOREIGN KEY (tenant_id,intake_submission_id) REFERENCES intake_submissions(tenant_id,id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX case_files_submission_object_once_idx ON case_files(tenant_id,intake_submission_id,object_id) WHERE intake_submission_id IS NOT NULL;

INSERT INTO case_intake_submission_links(tenant_id,case_id,submission_id,linked_by,linked_at)
SELECT tenant_id,operational_case_id,id,COALESCE(created_by,'migration-0017'),COALESCE(accepted_at,updated_at,created_at)
FROM intake_submissions
WHERE operational_case_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
