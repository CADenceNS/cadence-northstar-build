BEGIN;

DROP INDEX IF EXISTS patients_tenant_practice_reference_nonblank_unique;

-- Do not discard optional references merely to make a rollback succeed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM patients
    WHERE patient_reference=''
    GROUP BY tenant_id,practice_id,patient_reference
    HAVING count(*)>1
  ) THEN
    RAISE EXCEPTION 'Cannot restore the required patient-reference uniqueness constraint while duplicate blank references exist.';
  END IF;
END;
$$;

ALTER TABLE patients
  ADD CONSTRAINT patients_tenant_id_practice_id_patient_reference_key
  UNIQUE(tenant_id,practice_id,patient_reference);

COMMIT;
