BEGIN;

CREATE TABLE environment_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_name text NOT NULL CHECK(environment_name IN ('development','integration','uat','production')),
  application_version text NOT NULL,
  api_version text NOT NULL,
  build_version text NOT NULL,
  git_commit text NOT NULL,
  migration_version text NOT NULL,
  built_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(environment_name)
);

CREATE TABLE feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  flag_key text NOT NULL,
  description text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  environments text[] NOT NULL DEFAULT '{}',
  roles text[] NOT NULL DEFAULT '{}',
  expires_at timestamptz,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,flag_key)
);

CREATE TABLE uat_test_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  sprint text NOT NULL,
  module text NOT NULL,
  description text NOT NULL DEFAULT '',
  owner_id text NOT NULL,
  owner_name text NOT NULL,
  status text NOT NULL CHECK(status IN ('draft','ready','in-progress','blocked','complete','approved')),
  target_environment text NOT NULL CHECK(target_environment IN ('development','integration','uat')),
  build_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE uat_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES uat_test_plans(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL,
  preconditions text NOT NULL DEFAULT '',
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_result text NOT NULL,
  related_module text NOT NULL,
  priority text NOT NULL CHECK(priority IN ('low','medium','high','critical')),
  severity text NOT NULL CHECK(severity IN ('low','medium','high','critical')),
  assigned_role text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE uat_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  test_case_id uuid NOT NULL REFERENCES uat_test_cases(id) ON DELETE CASCADE,
  tester_id text NOT NULL,
  tester_name text NOT NULL,
  environment text NOT NULL CHECK(environment IN ('development','integration','uat')),
  build_version text NOT NULL,
  git_commit text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  duration_seconds integer CHECK(duration_seconds IS NULL OR duration_seconds >= 0),
  status text NOT NULL CHECK(status IN ('not-run','pass','fail','blocked')),
  actual_result text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE uat_defects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  defect_number text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  environment text NOT NULL CHECK(environment IN ('development','integration','uat','production')),
  module text NOT NULL,
  sprint text NOT NULL,
  severity text NOT NULL CHECK(severity IN ('low','medium','high','critical')),
  priority text NOT NULL CHECK(priority IN ('low','medium','high','critical')),
  status text NOT NULL CHECK(status IN ('new','triaged','in-progress','ready-for-retest','verified','closed')),
  reporter_id text NOT NULL,
  reporter_name text NOT NULL,
  assignee_id text,
  assignee_name text,
  related_test_case_id uuid REFERENCES uat_test_cases(id) ON DELETE SET NULL,
  related_build text NOT NULL,
  related_git_commit text NOT NULL,
  role_context text,
  resolution_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,defect_number)
);

CREATE TABLE uat_evidence_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_type text NOT NULL CHECK(owner_type IN ('test-case','execution','defect')),
  owner_id uuid NOT NULL,
  object_id uuid NOT NULL REFERENCES object_records(id) ON DELETE RESTRICT,
  uploaded_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,owner_type,owner_id,object_id)
);

CREATE TABLE uat_seed_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  seed_version text NOT NULL,
  environment text NOT NULL CHECK(environment IN ('development','uat')),
  scenario_ids text[] NOT NULL DEFAULT '{}',
  checksum text NOT NULL,
  status text NOT NULL CHECK(status IN ('started','complete','failed')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX uat_plan_status_idx ON uat_test_plans(tenant_id,status,updated_at DESC);
CREATE INDEX uat_case_plan_idx ON uat_test_cases(tenant_id,plan_id,sort_order);
CREATE INDEX uat_execution_case_idx ON uat_executions(tenant_id,test_case_id,created_at DESC);
CREATE INDEX uat_defect_status_idx ON uat_defects(tenant_id,status,severity,updated_at DESC);
CREATE INDEX uat_evidence_owner_idx ON uat_evidence_attachments(tenant_id,owner_type,owner_id,created_at DESC);
CREATE INDEX feature_flag_lookup_idx ON feature_flags(tenant_id,flag_key,enabled);

COMMIT;
