BEGIN;

ALTER TABLE product_catalog
  DROP COLUMN IF EXISTS default_customer_price,
  DROP COLUMN IF EXISTS promotional_price;

CREATE TABLE practice_routing_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  practice_id text NOT NULL,
  preferred_route text NOT NULL CHECK (preferred_route IN ('internal','outsourced','hybrid','manual-review')),
  preferred_outsource_partner text,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,practice_id)
);

CREATE TABLE tenant_routing_defaults (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id),
  preferred_route text NOT NULL CHECK (preferred_route IN ('internal','outsourced','hybrid','manual-review')),
  preferred_outsource_partner text,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pricing_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  schedule_type text NOT NULL CHECK (schedule_type IN ('standard','contract','promotion','customer-override')),
  name text NOT NULL,
  practice_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pricing_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  schedule_id uuid NOT NULL REFERENCES pricing_schedules(id) ON DELETE CASCADE,
  catalog_product_id uuid NOT NULL REFERENCES product_catalog(id),
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('fixed-price','percentage','amount')),
  adjustment_value numeric(12,2) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(schedule_id,catalog_product_id)
);

CREATE INDEX practice_routing_profiles_lookup_idx ON practice_routing_profiles(tenant_id,practice_id) WHERE active=true;
CREATE INDEX pricing_schedules_resolution_idx ON pricing_schedules(tenant_id,practice_id,active,priority,starts_at,ends_at);

COMMIT;
