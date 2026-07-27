# Database Architecture

## PostgreSQL baseline

Sprint 9 targets PostgreSQL 16. The initial migration is `apps/api/migrations/0001_infrastructure_core.sql`; its paired rollback is `0001_infrastructure_core.rollback.sql`.

## Domain schema

The schema is tenant-scoped and normalized across authentication, practices, doctors, patients, cases, production, QC, shipping, billing, object metadata, and audit events. Join tables represent shipment-to-case and invoice-to-shipment relationships. Financial line items, adjustments, and payments are separate records.

## Integrity

- UUID primary keys for operational records.
- Foreign keys preserve Practice → Doctor → Patient → Case relationships.
- Unique account, case, shipment, tracking, invoice, statement, and object keys.
- Queue, due-date, SLA, outcome, tracking, AR, audit, and object-owner indexes.
- `numeric(14,2)` monetary columns.
- Soft-delete timestamps on mutable master and operational records.
- Audit events are protected by a database trigger that rejects updates and deletes.
- Multi-repository writes must use `RepositoryRegistry.transaction`.

## Migration procedure

1. Back up the target database.
2. Verify PostgreSQL 16 and required privileges.
3. Run the migration with `ON_ERROR_STOP=1`.
4. Run repository integration tests and all application regressions.
5. Import a versioned legacy snapshot inside one transaction.
6. Reconcile counts, unique identifiers, invoice balances, attachments, and audit totals.
7. Enable PostgreSQL repositories only after parity checks pass.

## Rollback

The rollback script removes Sprint 9 tables and the audit immutability trigger. In production, rollback requires restoring the pre-migration backup because destructive schema rollback does not preserve imported records.

## Data migration assumptions

- Current process-memory identifiers are stable and can be preserved as UUID-compatible or migrated through an ID map.
- Existing timestamps are authoritative when present.
- Base64 attachments must be decoded, checksummed, uploaded through `ObjectStorage`, and replaced by object metadata records.
- Existing financial amounts require reconciliation before activation.
- Duplicate tracking numbers, account numbers, case numbers, or shipment links must be resolved before import.

## Deferred provider work

Cloud object providers, encryption-key management, malware scanning, lifecycle retention, read replicas, connection pooling proxies, partitioning, and tenant-specific data residency remain separate infrastructure work.
