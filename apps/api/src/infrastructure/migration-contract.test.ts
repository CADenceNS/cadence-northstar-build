import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration=await readFile(new URL('../../migrations/0001_infrastructure_core.sql',import.meta.url),'utf8');
const rollback=await readFile(new URL('../../migrations/0001_infrastructure_core.rollback.sql',import.meta.url),'utf8');
const tenantMigration=await readFile(new URL('../../migrations/0008_tenant_native_operations.sql',import.meta.url),'utf8');
const tenantRollback=await readFile(new URL('../../migrations/0008_tenant_native_operations.rollback.sql',import.meta.url),'utf8');
const requiredTables=['tenants','users','practices','doctors','patients','clinical_cases','production_work_items','qc_templates','qc_inspections','shipments','shipment_cases','invoices','invoice_lines','invoice_adjustments','payments','monthly_statements','object_records','audit_events'];
for(const table of requiredTables)assert.match(migration,new RegExp(`CREATE TABLE ${table}\\b`));
assert.match(migration,/FOREIGN KEY|REFERENCES/);assert.match(migration,/CREATE INDEX/);assert.match(migration,/UNIQUE/);assert.match(migration,/deleted_at/);assert.match(migration,/prevent_audit_mutation/);assert.match(migration,/numeric\(14,2\)/);assert.match(rollback,/DROP TABLE IF EXISTS audit_events/);
assert.match(tenantMigration,/ALTER TABLE tenants/);assert.match(tenantMigration,/TRIAL','ACTIVE','SUSPENDED','CANCELLED/);assert.match(tenantMigration,/activation_state/);assert.match(tenantMigration,/identity_memberships/);assert.match(tenantMigration,/platform_role/);assert.match(tenantMigration,/tenant_migration_ledger/);assert.match(tenantMigration,/ON CONFLICT \(migration_key\) DO NOTHING/);assert.match(tenantRollback,/DROP TABLE IF EXISTS tenant_migration_ledger/);
console.log('Migration structure and rollback contract passed.');
