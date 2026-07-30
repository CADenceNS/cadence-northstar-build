import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration=await readFile(new URL('../../migrations/0001_infrastructure_core.sql',import.meta.url),'utf8');
const rollback=await readFile(new URL('../../migrations/0001_infrastructure_core.rollback.sql',import.meta.url),'utf8');
const requiredTables=['tenants','users','practices','doctors','patients','clinical_cases','production_work_items','qc_templates','qc_inspections','shipments','shipment_cases','invoices','invoice_lines','invoice_adjustments','payments','monthly_statements','object_records','audit_events'];
for(const table of requiredTables)assert.match(migration,new RegExp(`CREATE TABLE ${table}\\b`));
assert.match(migration,/FOREIGN KEY|REFERENCES/);assert.match(migration,/CREATE INDEX/);assert.match(migration,/UNIQUE/);assert.match(migration,/deleted_at/);assert.match(migration,/prevent_audit_mutation/);assert.match(migration,/numeric\(14,2\)/);assert.match(rollback,/DROP TABLE IF EXISTS audit_events/);
console.log('Migration structure and rollback contract passed.');
