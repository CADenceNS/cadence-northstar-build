# Sprint 09 — Infrastructure Core: Durable Persistence

## Status

Infrastructure foundation implemented; domain cutover and validation pending. Sprint 9 is not complete.

## Objective

Replace process-memory persistence with PostgreSQL and provider-neutral object storage while preserving every verified workflow and business rule from Sprints 3–8.

## Implemented

- Typed repository contracts for Authentication, Practice, Doctor, Patient, Case, Production, QC, Shipping, Financial, and Audit domains.
- Tenant-aware repository context and transaction registry.
- PostgreSQL connection-pool and transaction infrastructure.
- PostgreSQL immutable audit repository and in-memory audit test implementation.
- Provider-neutral object-storage abstraction with in-memory and external-provider adapters.
- Normalized PostgreSQL migration covering all completed domains.
- Foreign keys, unique constraints, indexes, audit timestamps, financial decimal columns, and soft-delete fields.
- Immutable audit-event database trigger.
- Paired destructive rollback migration and documented backup-based rollback procedure.
- Transactional versioned legacy-snapshot importer.
- Repository, object-storage, migration-structure, migration apply/rollback, TypeScript, build, runtime, and browser validation pipeline.
- Architecture and database documentation.

## Remaining before completion

- Implement concrete PostgreSQL repositories for every domain contract.
- Inject repository implementations into all running application services.
- Remove all module-level process-memory arrays from production runtime paths.
- Replace base64 attachment persistence with object metadata and object-storage writes.
- Emit immutable audit events from every authenticated mutation and lifecycle transition.
- Add PostgreSQL repository integration tests for CRUD, relationships, transactions, concurrency, soft deletion, and tenant isolation.
- Add migration/backfill tests using representative Sprints 3–8 snapshots.
- Prove application restart persistence and behavior parity.

## Acceptance gates

- [ ] Frozen-lockfile installation passes from the committed lockfile.
- [ ] Strict TypeScript validation passes.
- [ ] Production build passes.
- [ ] PostgreSQL migration applies successfully.
- [ ] Rollback and reapplication pass.
- [ ] Every repository contract has a PostgreSQL implementation.
- [ ] Every production module uses repositories rather than process memory.
- [ ] Object storage persists all supported attachment/document classes.
- [ ] Audit events are emitted and immutable for all required domains.
- [ ] Repository integration and migration/backfill tests pass.
- [ ] Runtime validation passes against PostgreSQL.
- [ ] All prior Playwright regressions pass unchanged.
- [ ] Restart-persistence browser verification passes.

## Deferred

- Managed cloud object-storage provider credentials and deployment.
- Encryption-key management, malware scanning, and retention automation.
- Read replicas, partitioning, pooling proxies, and cross-region data residency.
- Multi-tenant administration UI.
- Scanner, CAD-processing, and AI-service event buses.

## Blocked

Sprint completion is blocked until the running application is fully cut over from process-memory stores to concrete PostgreSQL repositories and restart persistence is verified.
