BEGIN;
ALTER TABLE case_files DROP CONSTRAINT IF EXISTS case_files_intake_submission_fk;
DROP INDEX IF EXISTS case_files_submission_object_once_idx;
ALTER TABLE case_files DROP COLUMN IF EXISTS intake_submission_id;
DROP TABLE IF EXISTS case_intake_submission_links;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM case_intake_profiles WHERE intake_method='UNKNOWN') THEN
    RAISE EXCEPTION 'Cannot roll back 0017 while historical unknown intake classifications exist.';
  END IF;
END $$;
ALTER TABLE case_intake_profiles DROP CONSTRAINT IF EXISTS case_intake_profiles_intake_method_check;
ALTER TABLE case_intake_profiles ADD CONSTRAINT case_intake_profiles_intake_method_check CHECK (intake_method IN ('DIGITAL','PHYSICAL','HYBRID'));
ALTER TABLE intake_submissions DROP CONSTRAINT IF EXISTS intake_submissions_tenant_id_id_unique;
COMMIT;
