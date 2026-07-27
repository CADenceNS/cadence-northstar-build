CREATE TABLE communication_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('practice','doctor','patient','case','shipment','invoice')),
  entity_id text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','archived')),
  created_by text NOT NULL,
  created_by_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE communication_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  thread_id uuid REFERENCES communication_threads(id),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('phone-call','email','internal-note','doctor-message','laboratory-message','production-update','qc-comment','shipping-event','billing-event','attachment','system-event')),
  content text NOT NULL,
  actor_id text NOT NULL,
  actor_name text NOT NULL,
  actor_role text NOT NULL,
  version_of uuid REFERENCES communication_events(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE communication_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  event_id uuid NOT NULL REFERENCES communication_events(id) ON DELETE RESTRICT,
  object_id uuid NOT NULL REFERENCES object_records(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, object_id)
);

CREATE TABLE communication_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  event_id uuid NOT NULL REFERENCES communication_events(id) ON DELETE RESTRICT,
  recipient_user_id text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  category text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, recipient_user_id)
);

CREATE INDEX idx_communication_threads_entity ON communication_threads(tenant_id, entity_type, entity_id, created_at DESC);
CREATE INDEX idx_communication_events_entity ON communication_events(tenant_id, entity_type, entity_id, occurred_at DESC, id DESC);
CREATE INDEX idx_communication_events_thread ON communication_events(tenant_id, thread_id, occurred_at ASC, id ASC);
CREATE INDEX idx_communication_events_actor ON communication_events(tenant_id, actor_id, occurred_at DESC);
CREATE INDEX idx_communication_events_type ON communication_events(tenant_id, event_type, occurred_at DESC);
CREATE INDEX idx_communication_events_search ON communication_events USING gin (to_tsvector('english', content));
CREATE INDEX idx_communication_notifications_recipient ON communication_notifications(tenant_id, recipient_user_id, read_at, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_communication_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'communication events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER communication_events_immutable
BEFORE UPDATE OR DELETE ON communication_events
FOR EACH ROW EXECUTE FUNCTION prevent_communication_event_mutation();