BEGIN;
DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events;
DROP FUNCTION IF EXISTS prevent_audit_mutation();
DROP TABLE IF EXISTS audit_events, object_records, monthly_statements, payments, invoice_adjustments, invoice_lines, invoice_shipments, invoices, shipment_cases, shipments, qc_inspections, qc_templates, production_work_items, clinical_cases, patients, doctors, practices, users, tenants CASCADE;
COMMIT;
