BEGIN;

-- CF-1A2 commercial foundation. Module keys remain data rather than a database
-- enum so future modules can be added through the central catalog without a
-- schema redesign.
CREATE TABLE tenant_module_entitlements (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  module_key text NOT NULL,
  state text NOT NULL CHECK (state IN ('ACTIVE','DISABLED')),
  effective_from timestamptz,
  effective_until timestamptz,
  source text NOT NULL DEFAULT 'commercial-control-plane',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,module_key),
  CHECK (effective_until IS NULL OR effective_from IS NULL OR effective_until > effective_from)
);

CREATE TABLE tenant_module_seat_pools (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  module_key text NOT NULL,
  purchased_seat_count integer NOT NULL CHECK (purchased_seat_count >= 0),
  source text NOT NULL DEFAULT 'legacy-migration',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,module_key)
);

CREATE TABLE tenant_module_seat_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  module_key text NOT NULL,
  user_id text NOT NULL,
  assigned_by text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  released_by text,
  released_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK ((released_by IS NULL) = (released_at IS NULL))
);

CREATE UNIQUE INDEX tenant_module_active_seat_assignment_idx
  ON tenant_module_seat_assignments(tenant_id,module_key,user_id)
  WHERE released_at IS NULL;
CREATE INDEX tenant_module_seat_assignment_history_idx
  ON tenant_module_seat_assignments(tenant_id,module_key,user_id,assigned_at DESC);
CREATE INDEX tenant_module_entitlement_effective_idx
  ON tenant_module_entitlements(tenant_id,module_key)
  WHERE state='ACTIVE';

-- Existing NorthStar data stays operational after the explicit core gate is
-- introduced. The migration grants only the finite number of active
-- laboratory memberships that exist at migration time; it never creates an
-- unlimited pool and it does not move any operational data.
INSERT INTO tenant_module_entitlements(tenant_id,module_key,state,source,metadata)
SELECT id,'NORTHSTAR_CORE','ACTIVE','legacy-migration',jsonb_build_object('migration','0009_commercial_entitlements','compatibility','existing-laboratory-memberships')
FROM tenants WHERE id='00000000-0000-0000-0000-000000000001'
ON CONFLICT (tenant_id,module_key) DO NOTHING;

INSERT INTO tenant_module_entitlements(tenant_id,module_key,state,source,metadata)
SELECT id,'DESIGN_STUDIO','ACTIVE','legacy-migration',jsonb_build_object('migration','0009_commercial_entitlements','compatibility','existing-design-studio-users')
FROM tenants WHERE id='00000000-0000-0000-0000-000000000001'
ON CONFLICT (tenant_id,module_key) DO NOTHING;

INSERT INTO tenant_module_entitlements(tenant_id,module_key,state,source,metadata)
SELECT id,'GVM','DISABLED','legacy-migration',jsonb_build_object('migration','0009_commercial_entitlements')
FROM tenants WHERE id='00000000-0000-0000-0000-000000000001'
ON CONFLICT (tenant_id,module_key) DO NOTHING;

INSERT INTO tenant_module_seat_pools(tenant_id,module_key,purchased_seat_count,source)
SELECT t.id,module_key,COUNT(m.user_id)::integer,'legacy-migration'
FROM tenants t
CROSS JOIN (VALUES ('NORTHSTAR_CORE'),('DESIGN_STUDIO')) AS modules(module_key)
LEFT JOIN identity_memberships m ON m.tenant_id=t.id AND m.membership_status='ACTIVE' AND m.platform_role='none'
WHERE t.id='00000000-0000-0000-0000-000000000001'
GROUP BY t.id,module_key
ON CONFLICT (tenant_id,module_key) DO NOTHING;

INSERT INTO tenant_module_seat_pools(tenant_id,module_key,purchased_seat_count,source)
SELECT id,'GVM',0,'legacy-migration' FROM tenants WHERE id='00000000-0000-0000-0000-000000000001'
ON CONFLICT (tenant_id,module_key) DO NOTHING;

INSERT INTO tenant_module_seat_assignments(tenant_id,module_key,user_id,assigned_by,metadata)
SELECT m.tenant_id,modules.module_key,m.user_id,'legacy-migration',jsonb_build_object('migration','0009_commercial_entitlements')
FROM identity_memberships m
CROSS JOIN (VALUES ('NORTHSTAR_CORE'),('DESIGN_STUDIO')) AS modules(module_key)
WHERE m.tenant_id='00000000-0000-0000-0000-000000000001'
  AND m.membership_status='ACTIVE' AND m.platform_role='none'
ON CONFLICT DO NOTHING;

COMMIT;
