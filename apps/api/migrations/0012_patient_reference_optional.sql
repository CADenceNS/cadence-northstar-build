BEGIN;

-- A patient reference is an optional internal/chart identifier.  Preserve every
-- stored value while allowing more than one patient without an assigned reference.
ALTER TABLE patients
  DROP CONSTRAINT IF EXISTS patients_tenant_id_practice_id_patient_reference_key;

CREATE UNIQUE INDEX patients_tenant_practice_reference_nonblank_unique
  ON patients(tenant_id,practice_id,patient_reference)
  WHERE patient_reference<>'';

COMMIT;
