# Sprint 09 — Infrastructure Core: Durable Persistence

## Status

Sprint 9B repository integration is implemented and verified. Production runtime cutover and restart-persistence verification remain incomplete, so Sprint 9 is not complete.

## Objective

Replace process-memory persistence with PostgreSQL and provider-neutral object storage while preserving every verified workflow and business rule from Sprints 3–8.

## Implemented

- Typed repository contracts for Authentication, Practice, Doctor, Patient, Case, Production, QC, Shipping, Financial, and Audit domains.
- Concrete PostgreSQL implementations for every repository interface.
- Tenant-aware repository context and cross-repository transaction registry.
- PostgreSQL connection-pool and transaction infrastructure.
- PostgreSQL immutable audit repository and in-memory audit test implementation.
- Durable repository-document compatibility table with tenant isolation, soft deletion, version increments, and JSONB indexing.
- Provider-neutral object-storage abstraction with in-memory, external-provider, and PostgreSQL-backed implementations.
- PostgreSQL object bytes and metadata persistence with SHA-256 checksums.
- Normalized PostgreSQL migration covering all completed domains.
- Foreign keys, unique constraints, indexes, audit timestamps, financial decimal columns, and soft-delete fields.
- Immutable audit-event database trigger.
- Paired rollback migrations and documented backup-based rollback procedure.
- Transactional versioned legacy-snapshot importer.
- Repository, object-storage, migration-structure, migration apply/rollback/reapply, TypeScript, build, runtime, and browser validation pipelines.
- PostgreSQL integration tests for tenant isolation, soft deletion, transactional rollback, immutable audit events, and durable binary storage.
- Architecture and database documentation.

## Verified

Sprint 09 Validation run `30246441518` passed:

- Reproducible dependency installation.
- Strict TypeScript validation.
- Production build.
- In-memory repository contracts.
- Migration contract tests.
- PostgreSQL 16 migration application.
- Concrete PostgreSQL repository integration tests.
- Transaction rollback behavior.
- Tenant isolation.
- Soft-delete visibility.
- Immutable audit-event enforcement.
- PostgreSQL object-storage write, read, and delete behavior.
- Rollback and reapplication of both infrastructure migrations.
- Existing API and frontend startup.
- Every existing Playwright regression.

Runtime Validation run `30246441632` passed the inherited installation, build, startup, authentication, and browser regression gates.

## Remaining before completion

- Inject the PostgreSQL repository registry into every running application service.
- Remove all module-level process-memory arrays from production runtime paths.
- Replace production base64 case attachments and QC photos with `ObjectStorage` writes and stored-object references.
- Route invoice PDFs and shipping documents through `ObjectStorage` when those artifacts are generated.
- Emit immutable audit events from every authenticated mutation and lifecycle transition.
- Add relationship and concurrency tests against the fully injected runtime.
- Add representative Sprints 3–8 snapshot backfill tests.
- Prove application restart persistence with browser-visible data surviving service restart.
- Verify dashboard metrics while the running ERP is actually reading PostgreSQL repositories.

## Acceptance gates

- [x] Reproducible installation passes.
- [x] Strict TypeScript validation passes.
- [x] Production build passes.
- [x] PostgreSQL migrations apply successfully.
- [x] Rollback and reapplication pass.
- [x] Every repository contract has a concrete PostgreSQL implementation.
- [x] PostgreSQL repository integration tests pass.
- [x] Provider-neutral and PostgreSQL object-storage contracts pass.
- [x] All prior Playwright regressions pass unchanged.
- [ ] Every production module uses repositories rather than process memory.
- [ ] Production attachments and documents use object storage.
- [ ] Audit events are emitted for every required production mutation.
- [ ] Runtime validation executes against PostgreSQL-backed module services.
- [ ] Restart-persistence browser verification passes.

## Deferred

- Managed cloud object-storage provider credentials and deployment.
- Encryption-key management, malware scanning, and retention automation.
- Read replicas, partitioning, pooling proxies, and cross-region data residency.
- Multi-tenant administration UI.
- Scanner, CAD-processing, and AI-service event buses.

## Blocked

Sprint completion remains blocked until the running application is fully injected with PostgreSQL repositories, production attachments use object storage, mutation audit emission is complete, and restart persistence is verified end to end.
