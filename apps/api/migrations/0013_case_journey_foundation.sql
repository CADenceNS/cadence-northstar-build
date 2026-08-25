BEGIN;

CREATE TABLE case_journey_cases (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  case_entity_type text NOT NULL DEFAULT 'case' CHECK (case_entity_type='case'),
  case_id text NOT NULL,
  case_relationship text NOT NULL DEFAULT 'NEW' CHECK (case_relationship IN ('NEW','REMAKE','REPAIR','CONTINUATION')),
  root_case_id text NOT NULL,
  parent_case_id text,
  patient_id text NOT NULL,
  practice_id text NOT NULL,
  doctor_id text NOT NULL,
  continuation_operational_state text,
  continuation_billing_policy_id uuid,
  remake_repair_reason_id uuid,
  continuation_stage_id uuid,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,case_id),
  FOREIGN KEY (tenant_id,case_entity_type,case_id) REFERENCES repository_documents(tenant_id,entity_type,entity_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (tenant_id,root_case_id) REFERENCES case_journey_cases(tenant_id,case_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (tenant_id,parent_case_id) REFERENCES case_journey_cases(tenant_id,case_id) DEFERRABLE INITIALLY DEFERRED,
  CHECK ((case_relationship='NEW' AND parent_case_id IS NULL AND root_case_id=case_id) OR (case_relationship<>'NEW' AND parent_case_id IS NOT NULL AND root_case_id<>case_id)),
  CHECK (parent_case_id IS NULL OR parent_case_id<>case_id)
);

CREATE TABLE tenant_case_journey_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  code text NOT NULL,
  category text NOT NULL CHECK (category IN ('LAB_FABRICATION','CLINICAL_PRACTICE','REQUESTED_CHANGE','OTHER')),
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  suggested_responsibility text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id),
  UNIQUE(tenant_id,code)
);

CREATE TABLE tenant_continuation_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  code text NOT NULL,
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id),
  UNIQUE(tenant_id,code)
);

CREATE TABLE tenant_continuation_billing_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  policy_type text NOT NULL CHECK (policy_type IN ('BILL_AT_FINAL_COMPLETION','BILL_BY_MILESTONE','BILL_EVERY_CONTINUATION','HYBRID')),
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id),
  UNIQUE(tenant_id,policy_type)
);
CREATE UNIQUE INDEX tenant_continuation_policy_one_default_idx ON tenant_continuation_billing_policies(tenant_id) WHERE is_default AND active;

ALTER TABLE case_journey_cases
  ADD CONSTRAINT case_journey_reason_tenant_fk FOREIGN KEY (tenant_id,remake_repair_reason_id) REFERENCES tenant_case_journey_reasons(tenant_id,id),
  ADD CONSTRAINT case_journey_stage_tenant_fk FOREIGN KEY (tenant_id,continuation_stage_id) REFERENCES tenant_continuation_stages(tenant_id,id),
  ADD CONSTRAINT case_journey_policy_tenant_fk FOREIGN KEY (tenant_id,continuation_billing_policy_id) REFERENCES tenant_continuation_billing_policies(tenant_id,id);

CREATE TABLE case_journey_responsibilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  case_id text NOT NULL,
  responsibility_category text NOT NULL CHECK (responsibility_category IN ('LABORATORY','DOCTOR_PRACTICE','SHARED','PATIENT_EXTERNAL','OTHER_REQUIRES_REVIEW')),
  clinic_percentage numeric(5,2) NOT NULL CHECK (clinic_percentage>=0 AND clinic_percentage<=100),
  lab_percentage numeric(5,2) NOT NULL CHECK (lab_percentage>=0 AND lab_percentage<=100),
  confirmed_by text NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  notes text NOT NULL DEFAULT '',
  evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE(tenant_id,case_id),
  FOREIGN KEY (tenant_id,case_id) REFERENCES case_journey_cases(tenant_id,case_id),
  CHECK (clinic_percentage+lab_percentage=100)
);

CREATE INDEX case_journey_root_idx ON case_journey_cases(tenant_id,root_case_id,created_at);
CREATE INDEX case_journey_parent_idx ON case_journey_cases(tenant_id,parent_case_id,created_at);
CREATE INDEX case_journey_reason_active_idx ON tenant_case_journey_reasons(tenant_id,active,label);
CREATE INDEX continuation_stage_active_idx ON tenant_continuation_stages(tenant_id,active,label);

INSERT INTO tenant_case_journey_reasons(tenant_id,code,category,label)
SELECT t.id,seed.code,seed.category,seed.label FROM tenants t CROSS JOIN (VALUES
 ('MARGIN_FIT','LAB_FABRICATION','Margin / fit'),('GENERAL_FIT','LAB_FABRICATION','Internal/general fit'),('PROXIMAL_CONTACT','LAB_FABRICATION','Proximal contact / fit'),('OCCLUSION','LAB_FABRICATION','Occlusion'),('CONTOUR_ANATOMY','LAB_FABRICATION','Contour / anatomy'),('SHADE_MISMATCH','LAB_FABRICATION','Shade mismatch'),('ESTHETIC_MISMATCH','LAB_FABRICATION','Esthetic mismatch'),('FRACTURE_CHIPPING','LAB_FABRICATION','Fracture / chipping'),('MATERIAL_MANUFACTURING','LAB_FABRICATION','Material / manufacturing issue'),
 ('IMPRESSION_ISSUE','CLINICAL_PRACTICE','Impression issue'),('DIGITAL_SCAN_ISSUE','CLINICAL_PRACTICE','Digital scan issue'),('INSUFFICIENT_PREPARATION','CLINICAL_PRACTICE','Insufficient preparation / reduction'),('BITE_JAW_RELATION','CLINICAL_PRACTICE','Bite / jaw-relation issue'),('IMPLANT_COMPONENT','CLINICAL_PRACTICE','Implant / scanbody / component issue'),('INCOMPLETE_RX','CLINICAL_PRACTICE','Incomplete prescription'),('INCORRECT_RX','CLINICAL_PRACTICE','Incorrect prescription'),
 ('MATERIAL_CHANGE','REQUESTED_CHANGE','Material change'),('DESIGN_CHANGE','REQUESTED_CHANGE','Design change'),('SHADE_CHANGE','REQUESTED_CHANGE','Shade change'),('PATIENT_REQUEST','REQUESTED_CHANGE','Patient-requested change'),('DOCTOR_MODIFICATION','REQUESTED_CHANGE','Doctor-requested modification'),('OTHER_REVIEW','OTHER','Other / requires review')
) AS seed(code,category,label) ON CONFLICT(tenant_id,code) DO NOTHING;

INSERT INTO tenant_continuation_stages(tenant_id,code,label)
SELECT t.id,seed.code,seed.label FROM tenants t CROSS JOIN (VALUES
 ('BITE_BLOCK_WAX_RIM','Bite Block / Wax Rim'),('CUSTOM_TRAY','Custom Tray'),('FRAMEWORK_TRY_IN','Framework Try-In'),('METAL_TRY_IN','Metal Try-In'),('WAX_TRY_IN','Wax Try-In'),('TOOTH_SETUP_TRY_IN','Tooth Setup Try-In'),('BISQUE_TRY_IN','Bisque Try-In'),('VERIFICATION_JIG','Verification Jig'),('PASSIVE_FIT','Passive Fit / Framework Verification'),('IMPLANT_PROSTHETIC_TRY_IN','Implant Prosthetic Try-In'),('SHADE_ESTHETIC_TRY_IN','Shade / Esthetic Try-In'),('OCCLUSAL_VERIFICATION','Occlusal Verification'),('CLINICAL_ADJUSTMENT_RETURN','Clinical Adjustment Return'),('FINAL_PROCESSING_RETURN','Final Processing Return'),('OTHER_CONTINUATION','Other Continuation')
) AS seed(code,label) ON CONFLICT(tenant_id,code) DO NOTHING;

INSERT INTO tenant_continuation_billing_policies(tenant_id,policy_type,label,is_default,created_by)
SELECT t.id,seed.policy_type,seed.label,seed.is_default,'system'
FROM tenants t CROSS JOIN (VALUES
 ('BILL_AT_FINAL_COMPLETION','Bill at final completion',true),
 ('BILL_BY_MILESTONE','Bill by milestone',false),
 ('BILL_EVERY_CONTINUATION','Bill every continuation',false),
 ('HYBRID','Hybrid continuation billing',false)
) AS seed(policy_type,label,is_default)
ON CONFLICT DO NOTHING;

INSERT INTO case_journey_cases(tenant_id,case_id,case_relationship,root_case_id,parent_case_id,patient_id,practice_id,doctor_id,created_by,created_at,updated_at)
SELECT tenant_id,entity_id,'NEW',entity_id,NULL,payload->>'patientId',payload->>'practiceId',payload->>'doctorId','migration-0013',created_at,updated_at
FROM repository_documents
WHERE entity_type='case' AND deleted_at IS NULL
ON CONFLICT(tenant_id,case_id) DO NOTHING;

CREATE OR REPLACE FUNCTION prevent_case_journey_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.case_relationship,NEW.root_case_id,NEW.parent_case_id,NEW.patient_id,NEW.practice_id,NEW.doctor_id,NEW.continuation_operational_state,NEW.continuation_billing_policy_id,NEW.remake_repair_reason_id,NEW.continuation_stage_id) IS DISTINCT FROM (OLD.case_relationship,OLD.root_case_id,OLD.parent_case_id,OLD.patient_id,OLD.practice_id,OLD.doctor_id,OLD.continuation_operational_state,OLD.continuation_billing_policy_id,OLD.remake_repair_reason_id,OLD.continuation_stage_id) THEN
    RAISE EXCEPTION 'Case journey lineage and decision history are immutable after creation.';
  END IF;
  IF NEW.parent_case_id IS NOT NULL AND EXISTS (
    WITH RECURSIVE lineage(case_id,parent_case_id) AS (
      SELECT case_id,parent_case_id FROM case_journey_cases WHERE tenant_id=NEW.tenant_id AND case_id=NEW.parent_case_id
      UNION ALL SELECT item.case_id,item.parent_case_id FROM case_journey_cases item JOIN lineage parent ON item.case_id=parent.parent_case_id WHERE item.tenant_id=NEW.tenant_id
    ) SELECT 1 FROM lineage WHERE case_id=NEW.case_id
  ) THEN RAISE EXCEPTION 'Case journey lineage cannot contain a cycle.'; END IF;
  IF NEW.parent_case_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM case_journey_cases parent WHERE parent.tenant_id=NEW.tenant_id AND parent.case_id=NEW.parent_case_id AND parent.root_case_id=NEW.root_case_id AND parent.patient_id=NEW.patient_id) THEN
    RAISE EXCEPTION 'Parent case must belong to the same patient and root journey.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER case_journey_cycle_guard BEFORE INSERT OR UPDATE ON case_journey_cases FOR EACH ROW EXECUTE FUNCTION prevent_case_journey_cycle();

CREATE OR REPLACE FUNCTION prevent_case_journey_responsibility_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Case journey responsibility history is immutable after creation.';
END $$;
CREATE TRIGGER case_journey_responsibility_guard BEFORE UPDATE OR DELETE ON case_journey_responsibilities FOR EACH ROW EXECUTE FUNCTION prevent_case_journey_responsibility_mutation();

COMMIT;
