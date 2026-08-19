BEGIN;

DROP INDEX IF EXISTS tenant_module_entitlement_effective_idx;
DROP INDEX IF EXISTS tenant_module_seat_assignment_history_idx;
DROP INDEX IF EXISTS tenant_module_active_seat_assignment_idx;
DROP TABLE IF EXISTS tenant_module_seat_assignments;
DROP TABLE IF EXISTS tenant_module_seat_pools;
DROP TABLE IF EXISTS tenant_module_entitlements;

COMMIT;
