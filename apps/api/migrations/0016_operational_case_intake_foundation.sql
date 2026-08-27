BEGIN;

-- F2A2 extends the confirmed Case Builder without introducing a second product
-- catalog.  Every table is tenant-scoped and references the repository-backed
-- Case document used by F1/F2A1.
ALTER TABLE object_records ADD CONSTRAINT object_records_tenant_id_unique UNIQUE (tenant_id,id);

CREATE TABLE case_intake_profiles (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  case_entity_type text NOT NULL DEFAULT 'case' CHECK (case_entity_type='case'),
  case_id text NOT NULL,
  intake_method text NOT NULL CHECK (intake_method IN ('DIGITAL','PHYSICAL','HYBRID')),
  lifecycle_state text NOT NULL DEFAULT 'ACTIVE' CHECK (lifecycle_state IN ('ACTIVE','ON_HOLD','RELEASED','CANCELLED')),
  original_calculated_due_date date,
  current_calculated_due_date date,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,case_entity_type,case_id),
  FOREIGN KEY(tenant_id,case_entity_type,case_id) REFERENCES repository_documents(tenant_id,entity_type,entity_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX case_intake_profiles_lifecycle_idx ON case_intake_profiles(tenant_id,lifecycle_state,intake_method);

CREATE TABLE tenant_case_hold_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  code text NOT NULL,
  category text NOT NULL,
  label text NOT NULL,
  pauses_tat boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 100,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id),
  UNIQUE(tenant_id,code)
);
CREATE INDEX tenant_case_hold_reasons_active_idx ON tenant_case_hold_reasons(tenant_id,category,display_order) WHERE active;

CREATE TABLE tenant_case_cancellation_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  code text NOT NULL,
  category text NOT NULL,
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 100,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id),
  UNIQUE(tenant_id,code)
);
CREATE INDEX tenant_case_cancellation_reasons_active_idx ON tenant_case_cancellation_reasons(tenant_id,category,display_order) WHERE active;

CREATE TABLE case_hold_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  case_entity_type text NOT NULL DEFAULT 'case' CHECK (case_entity_type='case'),
  case_id text NOT NULL,
  reason_id uuid NOT NULL,
  notes text NOT NULL DEFAULT '',
  placed_by text NOT NULL,
  hold_start timestamptz NOT NULL DEFAULT now(),
  workflow_state_before text NOT NULL,
  original_calculated_due_date date,
  pauses_tat boolean NOT NULL,
  released_by text,
  released_at timestamptz,
  release_note text,
  resumed_state text,
  paused_business_duration integer,
  recalculated_due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,case_entity_type,case_id,hold_start),
  FOREIGN KEY(tenant_id,case_entity_type,case_id) REFERENCES repository_documents(tenant_id,entity_type,entity_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY(tenant_id,reason_id) REFERENCES tenant_case_hold_reasons(tenant_id,id)
);
CREATE UNIQUE INDEX case_hold_events_one_open_idx ON case_hold_events(tenant_id,case_entity_type,case_id) WHERE released_at IS NULL;
CREATE INDEX case_hold_events_case_idx ON case_hold_events(tenant_id,case_id,hold_start DESC);

CREATE TABLE case_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  case_entity_type text NOT NULL DEFAULT 'case' CHECK (case_entity_type='case'),
  case_id text NOT NULL,
  reason_id uuid NOT NULL,
  notes text NOT NULL DEFAULT '',
  cancelled_by text NOT NULL,
  cancelled_at timestamptz NOT NULL DEFAULT now(),
  prior_lifecycle_state text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,case_entity_type,case_id),
  FOREIGN KEY(tenant_id,case_entity_type,case_id) REFERENCES repository_documents(tenant_id,entity_type,entity_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY(tenant_id,reason_id) REFERENCES tenant_case_cancellation_reasons(tenant_id,id)
);

CREATE TABLE case_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  case_entity_type text NOT NULL DEFAULT 'case' CHECK (case_entity_type='case'),
  case_id text NOT NULL,
  object_id uuid NOT NULL,
  original_file_name text NOT NULL,
  display_name text NOT NULL,
  document_category text NOT NULL,
  description text NOT NULL DEFAULT '',
  source_kind text NOT NULL CHECK (source_kind IN ('ORIGINAL','DERIVED')),
  parent_file_id uuid,
  availability_state text NOT NULL DEFAULT 'AVAILABLE' CHECK (availability_state IN ('AVAILABLE','ARCHIVED','UNAVAILABLE')),
  uploaded_by text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  archived_by text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,case_entity_type,case_id) REFERENCES repository_documents(tenant_id,entity_type,entity_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY(tenant_id,object_id) REFERENCES object_records(tenant_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(tenant_id,parent_file_id) REFERENCES case_files(tenant_id,id)
);
CREATE INDEX case_files_case_idx ON case_files(tenant_id,case_id,uploaded_at DESC) WHERE availability_state <> 'ARCHIVED';
CREATE TABLE case_file_product_line_links (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  case_file_id uuid NOT NULL,
  case_product_line_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,case_file_id,case_product_line_id),
  FOREIGN KEY(tenant_id,case_file_id) REFERENCES case_files(tenant_id,id),
  FOREIGN KEY(tenant_id,case_product_line_id) REFERENCES case_product_lines(tenant_id,id)
);
CREATE FUNCTION prevent_case_file_source_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tenant_id<>OLD.tenant_id OR NEW.case_id<>OLD.case_id OR NEW.object_id<>OLD.object_id OR NEW.source_kind<>OLD.source_kind OR NEW.original_file_name<>OLD.original_file_name OR NEW.parent_file_id IS DISTINCT FROM OLD.parent_file_id THEN
    RAISE EXCEPTION 'Case File original source and lineage are immutable.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER case_files_source_guard BEFORE UPDATE ON case_files FOR EACH ROW EXECUTE FUNCTION prevent_case_file_source_mutation();

CREATE TABLE case_product_line_fulfillment (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  case_product_line_id uuid NOT NULL,
  fulfillment_mode text NOT NULL CHECK (fulfillment_mode IN ('IN_HOUSE','OUTSOURCED','SPLIT_HYBRID')),
  vendor_name text,
  notes text NOT NULL DEFAULT '',
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,case_product_line_id),
  FOREIGN KEY(tenant_id,case_product_line_id) REFERENCES case_product_lines(tenant_id,id)
);

CREATE TABLE vendor_case_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  case_entity_type text NOT NULL DEFAULT 'case' CHECK (case_entity_type='case'),
  case_id text NOT NULL,
  vendor_name text NOT NULL,
  package_status text NOT NULL DEFAULT 'READY' CHECK (package_status IN ('DRAFT','READY','SENT','ACKNOWLEDGED','CANCELLED')),
  delivery_channel text NOT NULL CHECK (delivery_channel IN ('SECURE_EMAIL','DROPBOX_INTEGRATION','VENDOR_PORTAL','PHYSICAL_SHIPMENT')),
  tracking_reference text,
  prepared_by text NOT NULL,
  prepared_at timestamptz NOT NULL DEFAULT now(),
  sent_by text,
  sent_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,case_entity_type,case_id) REFERENCES repository_documents(tenant_id,entity_type,entity_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX vendor_case_packages_case_idx ON vendor_case_packages(tenant_id,case_id,prepared_at DESC);
CREATE TABLE vendor_case_package_product_lines (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  package_id uuid NOT NULL REFERENCES vendor_case_packages(id) ON DELETE RESTRICT,
  case_product_line_id uuid NOT NULL,
  PRIMARY KEY(tenant_id,package_id,case_product_line_id),
  FOREIGN KEY(tenant_id,case_product_line_id) REFERENCES case_product_lines(tenant_id,id)
);
CREATE TABLE vendor_case_package_files (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  package_id uuid NOT NULL REFERENCES vendor_case_packages(id) ON DELETE RESTRICT,
  case_file_id uuid NOT NULL,
  PRIMARY KEY(tenant_id,package_id,case_file_id),
  FOREIGN KEY(tenant_id,case_file_id) REFERENCES case_files(tenant_id,id)
);

CREATE TABLE case_operational_events (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  case_entity_type text NOT NULL DEFAULT 'case' CHECK (case_entity_type='case'),
  case_id text NOT NULL,
  case_product_line_id uuid,
  event_type text NOT NULL,
  actor_id text NOT NULL,
  actor_name text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  FOREIGN KEY(tenant_id,case_entity_type,case_id) REFERENCES repository_documents(tenant_id,entity_type,entity_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY(tenant_id,case_product_line_id) REFERENCES case_product_lines(tenant_id,id)
);
CREATE INDEX case_operational_events_projection_idx ON case_operational_events(tenant_id,event_type,occurred_at DESC);
CREATE FUNCTION prevent_case_operational_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Case operational events are immutable.';
END;
$$;
CREATE TRIGGER case_operational_events_immutable BEFORE UPDATE OR DELETE ON case_operational_events FOR EACH ROW EXECUTE FUNCTION prevent_case_operational_event_mutation();

-- Preserve old records without guessing from their product type.  HYBRID is a
-- transparent migration state: new/edited cases must explicitly choose one of
-- the same controlled values in the operational profile.
INSERT INTO case_intake_profiles(tenant_id,case_entity_type,case_id,intake_method,lifecycle_state,original_calculated_due_date,current_calculated_due_date,created_by)
SELECT tenant_id,'case',entity_id,'HYBRID','ACTIVE',NULLIF(payload->>'calculatedDueDate','')::date,NULLIF(payload->>'dueDate','')::date,'migration-0016'
FROM repository_documents WHERE entity_type='case' AND deleted_at IS NULL
ON CONFLICT DO NOTHING;

WITH seeds(category,code,label,pauses_tat,display_order) AS (VALUES
 ('CLINICAL / QUALITY','CLN-Margin','Margin unreadable / covered by tissue',true,10),('CLINICAL / QUALITY','CLN-Clearance','Insufficient occlusal reduction',true,20),('CLINICAL / QUALITY','CLN-Distortion','Physical pull or digital scan data void',true,30),('CLINICAL / QUALITY','CLN-Bite','Opposing arches do not articulate / clash',true,40),('CLINICAL / QUALITY','CLN-Undercut','Path of insertion blocked by undercut',true,50),('CLINICAL / QUALITY','CLN-MUA-Ang','Multi-Unit Abutment angle unfeasible',true,60),('CLINICAL / QUALITY','CLN-Tissue','Soft tissue compression / interference',true,70),('CLINICAL / QUALITY','CLN-Implant-Mob','Implant failure / mobility concern',true,80),
 ('PRESCRIPTION / DESIGN','RX-Shade','Missing final tooth shade',true,110),('PRESCRIPTION / DESIGN','RX-Stump','Missing prep stump shade',true,120),('PRESCRIPTION / DESIGN','RX-Material','Restoration material unspecified',true,130),('PRESCRIPTION / DESIGN','RX-System','Missing implant brand/platform size',true,140),('PRESCRIPTION / DESIGN','RX-Opposing','Missing opposing arch',true,150),('PRESCRIPTION / DESIGN','RX-Pontic','Missing bridge pontic design',true,160),('PRESCRIPTION / DESIGN','RX-Margin-Des','Margin design unresolved',true,170),('PRESCRIPTION / DESIGN','RX-Clasp','Partial denture clasp type/placement missing',true,180),
 ('LOGISTICS / MATERIAL','MAT-Backorder','Required part/material unavailable',true,210),('LOGISTICS / MATERIAL','MAT-Missing','Required part/screw/jig missing',true,220),('LOGISTICS / MATERIAL','MAT-Enclosure','Required fit-to item missing',true,230),('LOGISTICS / MATERIAL','MAT-File-Corrupt','Corrupt digital file',true,240),('LOGISTICS / MATERIAL','MAT-Model-Fx','Physical model damaged',true,250),
 ('RECOMMENDATION / ALTERATION','REC-Material','Lab recommends material change',false,310),('RECOMMENDATION / ALTERATION','REC-TryIn','Try-in required before next stage',false,320),('RECOMMENDATION / ALTERATION','REC-Jig','Verification jig required',false,330),('RECOMMENDATION / ALTERATION','REC-Prep','Re-preparation recommended',true,340),('RECOMMENDATION / ALTERATION','REC-Schedule','Requested chair date conflicts with required TAT',false,350),
 ('ADMINISTRATIVE','ADM-Credit','Authorized account/credit hold',false,410),('ADMINISTRATIVE','ADM-No-ID','Missing/unknown Doctor, Practice, or Patient identity',true,420),('ADMINISTRATIVE','ADM-Signature','Missing required prescription authorization',true,430),('ADMINISTRATIVE','ADM-Duplicate','Potential duplicate case',false,440)
)
INSERT INTO tenant_case_hold_reasons(tenant_id,category,code,label,pauses_tat,display_order)
SELECT tenant.id,seeds.category,seeds.code,seeds.label,seeds.pauses_tat,seeds.display_order FROM tenants tenant CROSS JOIN seeds ON CONFLICT(tenant_id,code) DO NOTHING;

WITH seeds(category,code,label,display_order) AS (VALUES
 ('CLINICAL','CLN-Remake-Req','Doctor requested complete re-prep / re-scan',10),('CLINICAL','CLN-Patient-Loss','Patient discontinued treatment',20),('CLINICAL','CLN-Treatment-Chg','Clinical treatment changed',30),('CLINICAL','CLN-Implant-Fail','Implant failed before seating',40),('CLINICAL','CLN-Abutment-Mob','Abutment/supporting tooth became mobile/fractured',50),('CLINICAL','CLN-Health-Issue','Patient health/medical issue',60),
 ('PRESCRIPTION / DESIGN','RX-Dr-Request','Doctor requested cancellation',110),('PRESCRIPTION / DESIGN','RX-Incomplete','Unresolved extended hold/no response',120),('PRESCRIPTION / DESIGN','RX-Spec-Mism','Requirements cannot be met with supported materials/workflow',130),('PRESCRIPTION / DESIGN','RX-Lab-Incapable','Lab cannot manufacture within supported technical constraints',140),
 ('MATERIAL / LOGISTICS','MAT-Timeline','Critical requested timeline cannot be met',210),('MATERIAL / LOGISTICS','MAT-Data-Lost','Required data irrecoverable',220),('MATERIAL / LOGISTICS','MAT-Discontinued','Required proprietary component/material discontinued',230),('MATERIAL / LOGISTICS','MAT-Inbound-Dmg','Physical case unusably damaged',240),
 ('ADMINISTRATIVE / FINANCIAL','ADM-Duplicate','Verified duplicate Case',310),('ADMINISTRATIVE / FINANCIAL','ADM-Bad-Debt','Authorized cancellation under account policy',320),('ADMINISTRATIVE / FINANCIAL','ADM-Entered-Err','Case created in error',330),('ADMINISTRATIVE / FINANCIAL','ADM-Dr-Discharge','Doctor/Practice relationship terminated',340)
)
INSERT INTO tenant_case_cancellation_reasons(tenant_id,category,code,label,display_order)
SELECT tenant.id,seeds.category,seeds.code,seeds.label,seeds.display_order FROM tenants tenant CROSS JOIN seeds ON CONFLICT(tenant_id,code) DO NOTHING;

-- Correct F2A1's mixed controlled values without changing existing snapshots.
INSERT INTO tenant_option_sets(tenant_id,code,label,display_order)
SELECT tenant.id,seed.code,seed.label,seed.display_order FROM tenants tenant CROSS JOIN (VALUES
 ('CEMENTATION_RESPONSIBILITY','Cementation responsibility',55),('CEMENT_BONDING_PROTOCOL','Cement / bonding protocol',60),('SHADE_APPOINTMENT','Shade appointment requirement',65)
) AS seed(code,label,display_order) ON CONFLICT(tenant_id,code) DO NOTHING;
UPDATE tenant_option_values value SET active=false,updated_at=now() FROM tenant_option_sets set WHERE value.tenant_id=set.tenant_id AND value.option_set_id=set.id AND ((set.code='SHADE' AND value.code IN ('SHADE_PHOTO_ATTACHED','SHADE_APPOINTMENT_REQUIRED')) OR (set.code='STUMP_SHADE' AND value.code IN ('PHOTO_ATTACHED','NOT_PROVIDED')) OR (set.code IN ('MARGIN_STANDARD','MARGIN_PFM') AND value.code IN ('DOCTOR_SPECIFIED','FOLLOW_EXISTING','REQUIRES_REVIEW')) OR (set.code='CEMENT_PROTOCOL' AND value.code IN ('DOCTOR_TO_CEMENT','LABORATORY_CEMENTATION')));
INSERT INTO tenant_option_values(tenant_id,option_set_id,code,label,metadata,display_order)
SELECT set.tenant_id,set.id,seed.code,seed.label,seed.metadata,seed.display_order
FROM tenant_option_sets set JOIN (VALUES
 ('SHADE_SYSTEM','VITA_SYSTEM_3D_MASTER','VITA SYSTEM 3D-MASTER','{}'::jsonb,20),('SHADE_SYSTEM','VITA_BLEACHED_3D_MASTER','VITA Bleachedguide 3D-MASTER','{}'::jsonb,30),('SHADE_SYSTEM','OTHER_CUSTOM','Other / Custom','{}'::jsonb,40),
 ('SHADE','1M1','1M1','{"shadeSystem":"VITA_SYSTEM_3D_MASTER"}'::jsonb,200),('SHADE','1M2','1M2','{"shadeSystem":"VITA_SYSTEM_3D_MASTER"}'::jsonb,210),('SHADE','2M1','2M1','{"shadeSystem":"VITA_SYSTEM_3D_MASTER"}'::jsonb,220),('SHADE','2M2','2M2','{"shadeSystem":"VITA_SYSTEM_3D_MASTER"}'::jsonb,230),('SHADE','3M1','3M1','{"shadeSystem":"VITA_SYSTEM_3D_MASTER"}'::jsonb,240),('SHADE','3M2','3M2','{"shadeSystem":"VITA_SYSTEM_3D_MASTER"}'::jsonb,250),('SHADE','0M1_BLEACHED','0M1','{"shadeSystem":"VITA_BLEACHED_3D_MASTER"}'::jsonb,260),('SHADE','0M2_BLEACHED','0M2','{"shadeSystem":"VITA_BLEACHED_3D_MASTER"}'::jsonb,270),('SHADE','0M3_BLEACHED','0M3','{"shadeSystem":"VITA_BLEACHED_3D_MASTER"}'::jsonb,280),('SHADE','OTHER_CUSTOM','Other / Custom','{}'::jsonb,290),
 ('STUMP_SHADE','OTHER_CUSTOM','Other / Custom','{}'::jsonb,140),
 ('CEMENTATION_RESPONSIBILITY','DOCTOR_CLINIC','Doctor / Clinic to cement','{}'::jsonb,10),('CEMENTATION_RESPONSIBILITY','LABORATORY','Laboratory to cement','{}'::jsonb,20),('CEMENTATION_RESPONSIBILITY','NOT_APPLICABLE','Not applicable','{}'::jsonb,30),('CEMENTATION_RESPONSIBILITY','OTHER_CUSTOM','Other / Custom','{}'::jsonb,40),
 ('CEMENT_BONDING_PROTOCOL','CONVENTIONAL','Conventional cementation','{}'::jsonb,10),('CEMENT_BONDING_PROTOCOL','RMGI','Resin-modified glass ionomer','{}'::jsonb,20),('CEMENT_BONDING_PROTOCOL','SELF_ADHESIVE_RESIN','Self-adhesive resin cement','{}'::jsonb,30),('CEMENT_BONDING_PROTOCOL','ADHESIVE_RESIN','Adhesive resin cement','{}'::jsonb,40),('CEMENT_BONDING_PROTOCOL','PROVISIONAL','Provisional cement','{}'::jsonb,50),('CEMENT_BONDING_PROTOCOL','MANUFACTURER_PROTOCOL','Manufacturer-specific protocol','{}'::jsonb,60),('CEMENT_BONDING_PROTOCOL','OTHER_CUSTOM','Other / Custom','{}'::jsonb,70),('CEMENT_BONDING_PROTOCOL','NOT_APPLICABLE','Not applicable','{}'::jsonb,80),
 ('SHADE_APPOINTMENT','NOT_REQUESTED','Not requested','{}'::jsonb,10),('SHADE_APPOINTMENT','REQUESTED','Requested','{}'::jsonb,20),('SHADE_APPOINTMENT','SCHEDULED','Scheduled','{}'::jsonb,30),('SHADE_APPOINTMENT','COMPLETED','Completed','{}'::jsonb,40)
) AS seed(set_code,code,label,metadata,display_order) ON set.code=seed.set_code
ON CONFLICT(tenant_id,option_set_id,code) DO UPDATE SET label=EXCLUDED.label,metadata=EXCLUDED.metadata,active=true,display_order=EXCLUDED.display_order,updated_at=now();
UPDATE tenant_option_values value SET metadata=jsonb_set(value.metadata,'{shadeSystem}','"VITA_BLEACHED_3D_MASTER"'::jsonb),updated_at=now() FROM tenant_option_sets set WHERE value.tenant_id=set.tenant_id AND value.option_set_id=set.id AND set.code='SHADE' AND value.code IN ('0M1','0M2','0M3');
UPDATE tenant_option_values value SET active=false,updated_at=now() FROM tenant_option_sets set WHERE value.tenant_id=set.tenant_id AND value.option_set_id=set.id AND ((set.code='SHADE_SYSTEM' AND value.code='BLEACHED') OR (set.code='SHADE' AND value.code IN ('CUSTOM_SHADE','CUSTOM')) OR (set.code='STUMP_SHADE' AND value.code='CUSTOM'));
UPDATE tenant_option_values value SET code='OTHER_CUSTOM',label='Other / Custom',updated_at=now() FROM tenant_option_sets set WHERE value.tenant_id=set.tenant_id AND value.option_set_id=set.id AND set.code='STUMP_SHADE' AND value.code='CUSTOM' AND NOT EXISTS(SELECT 1 FROM tenant_option_values duplicate WHERE duplicate.tenant_id=value.tenant_id AND duplicate.option_set_id=value.option_set_id AND duplicate.code='OTHER_CUSTOM');
UPDATE product_configuration_requirements requirement SET field_key='cementBondingProtocol',label='Cement / bonding protocol',option_set_id=set.id,allow_custom=true,updated_at=now() FROM tenant_option_sets set WHERE requirement.tenant_id=set.tenant_id AND requirement.field_key='cementProtocol' AND set.code='CEMENT_BONDING_PROTOCOL';
INSERT INTO product_configuration_requirements(tenant_id,product_id,field_key,label,option_set_id,requirement_state,allow_custom,display_order)
SELECT product.tenant_id,product.id,seed.field_key,seed.label,set.id,seed.requirement_state,seed.allow_custom,seed.display_order FROM product_catalog product JOIN tenant_option_sets set ON set.tenant_id=product.tenant_id JOIN (VALUES
 ('cementationResponsibility','Cementation responsibility','CEMENTATION_RESPONSIBILITY','OPTIONAL',true,35),('shadeAppointment','Shade appointment requirement','SHADE_APPOINTMENT','OPTIONAL',false,75)
) seed(field_key,label,set_code,requirement_state,allow_custom,display_order) ON set.code=seed.set_code WHERE product.category_code='FIX'
ON CONFLICT(tenant_id,product_id,field_key) DO NOTHING;

COMMIT;
