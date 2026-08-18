# Database Architecture

## PostgreSQL baseline

Sprint 9 targets PostgreSQL 16. Migrations are applied in order:

1. `apps/api/migrations/0001_infrastructure_core.sql`
2. `apps/api/migrations/0002_repository_documents.sql`
3. `apps/api/migrations/0003_identity_security.sql` through `0008_tenant_native_operations.sql`

Each migration has a paired rollback script.

## Production repositories

The production runtime requires `DATABASE_URL` and builds a tenant-scoped `PostgresRegistry`. Authentication, practices, doctors, patients, cases, production work items, QC templates and inspections, shipments, invoices, statements, and audit events are loaded and saved through repository interfaces.

The repository-document compatibility layer preserves the verified Sprint 8 domain payloads while the normalized tables remain available for progressive domain-specific optimization. Production runtime code does not depend on module-level process-memory arrays.

## Object storage

`PostgresObjectStorage` stores object metadata in `object_records` and binary bytes in `object_blobs`. Supported kinds include STL, OBJ, PLY, DICOM/CBCT, clinical photos, QC photos, RX PDFs, shipping documents, and invoice PDFs.

Backward-compatible APIs may accept and return base64. Production handlers decode the payload, calculate a SHA-256 checksum, write the bytes through `ObjectStorage`, and persist only an internal object reference in the owning domain record.

## Integrity

- Tenant-scoped entity keys and repository lookups.
- UUID identifiers for operational entities.
- Foreign keys in the normalized schema preserve Practice → Doctor → Patient → Case relationships.
- Unique account, case, shipment, tracking, invoice, statement, repository-document, and object keys.
- Queue, due-date, SLA, outcome, tracking, AR, audit, JSONB payload, and object-owner indexes.
- Soft-delete timestamps and repository version increments.
- Financial numeric columns in normalized financial tables.
- Audit events protected by a trigger that rejects updates and deletes.
- Cross-repository transaction support through `RepositoryRegistry.transaction`.

## Migration and backfill procedure

1. Back up the target database.
2. Verify PostgreSQL 16, extensions, and privileges.
3. Apply migrations with `ON_ERROR_STOP=1`.
4. Import the versioned legacy snapshot inside one transaction.
5. Decode and move binary payloads through `ObjectStorage`.
6. Reconcile entity counts, relationships, identifiers, financial balances, object checksums, and audit totals.
7. Run PostgreSQL repository integrations, restart-persistence validation, dashboard verification, and the complete Playwright suite.
8. Enable the production composition root only after every parity gate passes.

## CF-1A1 tenant-native ownership migration

Migration `0008_tenant_native_operations.sql` makes the laboratory tenant lifecycle and membership state explicit. Every existing operational record already has a required `tenant_id`; the migration does not copy, merge, or reassign those rows. Existing NorthStar records remain assigned exactly once to the designated legacy tenant, recorded in `tenant_migration_ledger`. New live requests derive ownership from the authenticated tenant context, not from body, query, route, or header values.

## Rollback

The paired rollback scripts are intentionally destructive and are validated in CI through rollback and reapplication. Production rollback requires restoring the pre-migration database and object backup because schema rollback does not preserve imported records.

## Verified persistence

Sprint 09 Validation run `30251342279` created a linked Practice, Doctor, Patient, Case, and RX PDF object; verified exactly one immutable creation audit record; terminated the API process; restarted it against the same PostgreSQL database; and verified the relationship graph, object content, and dashboard metrics remained intact. The complete browser regression suite then passed against that restarted PostgreSQL-backed runtime.

## Deferred provider work

Managed cloud object providers, encryption-key management, malware scanning, lifecycle retention, read replicas, connection-pooling proxies, partitioning, and tenant-specific data residency remain later infrastructure work.
