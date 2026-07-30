BEGIN;

CREATE TABLE scanner_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  provider_key text NOT NULL,
  display_name text NOT NULL,
  provider_type text NOT NULL CHECK (provider_type IN ('official-adapter','generic-file','manual-upload','simulator','future-sdk')),
  production_ready boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,provider_key)
);

CREATE TABLE doctor_preference_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  doctor_id text NOT NULL,
  practice_id text NOT NULL,
  defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferred_route text CHECK (preferred_route IN ('internal','outsourced','hybrid','manual-review')),
  preferred_outsource_partner text,
  version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,doctor_id,version)
);

CREATE TABLE product_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  sku text NOT NULL,
  product_name text NOT NULL,
  restoration_category text NOT NULL,
  restoration_subtype text NOT NULL,
  material text,
  department text NOT NULL,
  accounting_category text NOT NULL,
  internal_cost numeric(12,2),
  outsource_cost numeric(12,2),
  default_customer_price numeric(12,2),
  promotional_price numeric(12,2),
  tax_status text NOT NULL DEFAULT 'taxable',
  turnaround_category text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,sku)
);

CREATE TABLE intake_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  submission_number text NOT NULL,
  intake_method text NOT NULL CHECK (intake_method IN ('automatic-digital','manual-digital','physical')),
  source_provider_id uuid REFERENCES scanner_providers(id),
  source_reference text,
  practice_id text,
  doctor_id text,
  patient_id text,
  status text NOT NULL CHECK (status IN ('received','prescription-required','validation','routing-review','accepted','rejected','operational-case-created')),
  received_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  operational_case_id text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,submission_number),
  UNIQUE(tenant_id,source_provider_id,source_reference)
);

CREATE TABLE digital_prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  submission_id uuid NOT NULL UNIQUE REFERENCES intake_submissions(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  practice_id text NOT NULL,
  doctor_id text NOT NULL,
  patient_id text,
  patient_name text,
  patient_reference text NOT NULL,
  shipping_location jsonb NOT NULL DEFAULT '{}'::jsonb,
  billing_account jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_information jsonb NOT NULL DEFAULT '{}'::jsonb,
  restorations jsonb NOT NULL DEFAULT '[]'::jsonb,
  clinical_information jsonb NOT NULL DEFAULT '{}'::jsonb,
  production_notes text NOT NULL DEFAULT '',
  special_instructions text NOT NULL DEFAULT '',
  preference_source jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE intake_attachments (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  submission_id uuid NOT NULL REFERENCES intake_submissions(id) ON DELETE CASCADE,
  object_id uuid NOT NULL REFERENCES object_records(id),
  purpose text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(submission_id,object_id)
);

CREATE TABLE intake_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  submission_id uuid NOT NULL REFERENCES intake_submissions(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('complete','incomplete','invalid','duplicate','requires-clinical-review','requires-routing-review','accepted','rejected')),
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  evaluated_by text NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE intake_routing_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  submission_id uuid NOT NULL REFERENCES intake_submissions(id) ON DELETE CASCADE,
  route text NOT NULL CHECK (route IN ('internal','outsourced','hybrid','manual-review')),
  precedence_source text NOT NULL CHECK (precedence_source IN ('case-override','doctor-profile','practice-profile','tenant-default','manual-review')),
  outsource_partner text,
  rationale text NOT NULL,
  resolved_by text NOT NULL,
  resolved_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE intake_product_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  submission_id uuid NOT NULL REFERENCES intake_submissions(id) ON DELETE CASCADE,
  catalog_product_id uuid REFERENCES product_catalog(id),
  sku text NOT NULL,
  product_category text NOT NULL,
  restoration_type text NOT NULL,
  restoration_subtype text NOT NULL,
  material text,
  quantity numeric(10,2) NOT NULL CHECK (quantity > 0),
  department text NOT NULL,
  accounting_category text NOT NULL,
  frozen_at timestamptz,
  resolved_by text NOT NULL,
  resolved_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE intake_billing_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  submission_id uuid NOT NULL UNIQUE REFERENCES intake_submissions(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending','approved','rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  notes text NOT NULL DEFAULT '',
  invoice_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE intake_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  submission_id uuid NOT NULL REFERENCES intake_submissions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id text NOT NULL,
  actor_name text NOT NULL,
  actor_role text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX intake_submissions_queue_idx ON intake_submissions(tenant_id,status,received_at);
CREATE INDEX intake_history_timeline_idx ON intake_history(tenant_id,submission_id,occurred_at);
CREATE INDEX intake_validations_submission_idx ON intake_validations(tenant_id,submission_id,evaluated_at DESC);
CREATE INDEX intake_products_submission_idx ON intake_product_resolutions(tenant_id,submission_id);

CREATE FUNCTION prevent_intake_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'intake history is immutable'; END $$;
CREATE TRIGGER intake_history_immutable BEFORE UPDATE OR DELETE ON intake_history FOR EACH ROW EXECUTE FUNCTION prevent_intake_history_mutation();

COMMIT;
