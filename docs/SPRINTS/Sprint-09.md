# Sprint 09 — Infrastructure Core: Durable Persistence

## Status

Complete. Sprint 9C production persistence cutover is implemented and verified.

## Objective

Replace process-memory persistence with PostgreSQL and provider-neutral object storage while preserving every verified workflow and business rule from Sprints 3–8.

## Implemented

- Typed repository contracts and concrete PostgreSQL implementations for Authentication, Practice, Doctor, Patient, Case, Production, QC, Shipping, Financial, and Audit domains.
- Production dependency injection through a PostgreSQL runtime composition root.
- PostgreSQL-backed authentication, directory management, patient and case intake, production queues, QC, shipping, billing, and dashboard metrics.
- No production route imports the legacy array-backed server.
- Provider-neutral `ObjectStorage` with PostgreSQL-backed production storage and in-memory test storage.
- Case files and QC photos are decoded from backward-compatible base64 API payloads, stored as durable object bytes, and returned through the existing API shape.
- Durable financial invoices, payments, adjustments, statements, and AR metrics.
- Immutable audit events for login, logout, master-data mutations, case lifecycle, production transitions, QC actions, shipping events, and financial events.
- Internal cross-module case synchronization suppresses duplicate audit records.
- Tenant-aware repository context, soft deletion, version increments, JSONB indexes, transaction registry, normalized domain schema, rollback migrations, and legacy snapshot importer.
- PostgreSQL runtime validation and full Playwright regression execution without user-facing workflow changes.

## Verified

Sprint 09 Validation run `30251342279` passed:

- Reproducible installation.
- Strict TypeScript validation and production build.
- Repository and migration contracts.
- PostgreSQL 16 migration application.
- PostgreSQL repository integrations.
- Rollback and reapplication.
- PostgreSQL-backed application startup.
- Practice → Doctor → Patient → Case relationship persistence.
- Durable RX PDF object bytes and backward-compatible retrieval.
- Exactly one `practice.created` immutable audit record for the tested mutation.
- API process termination and restart with all created data preserved.
- Dashboard metrics generated from preserved PostgreSQL records.
- Complete Sprints 3–8 Playwright regression suite exclusively against the PostgreSQL-backed runtime.

Runtime Validation run `30251342262` passed PostgreSQL provisioning, migrations, strict build, API health, frontend startup, authentication, session persistence, and the complete browser suite.

## Acceptance gates

- [x] Reproducible installation passes.
- [x] Strict TypeScript validation passes.
- [x] Production build passes.
- [x] PostgreSQL migrations apply, roll back, and reapply.
- [x] Every repository contract has a PostgreSQL implementation.
- [x] Every production module uses PostgreSQL repositories rather than process-memory persistence.
- [x] Production case and QC attachments use `ObjectStorage` while preserving existing API payloads.
- [x] Required mutation and lifecycle audit events are append-only and immutable.
- [x] Runtime validation executes against PostgreSQL-backed services.
- [x] Relationships and dashboard metrics remain correct after process restart.
- [x] All prior Playwright regressions pass without workflow redesign.

## Deferred

- Managed cloud object-storage provider credentials and deployment.
- Encryption-key management, malware scanning, and retention automation.
- Durable generation and cloud storage of invoice PDFs and shipping documents when those existing domains begin generating binary artifacts.
- Read replicas, partitioning, pooling proxies, and cross-region data residency.
- Multi-tenant administration UI.
- Scanner, CAD-processing, and AI-service event buses.

## Remaining blockers

None for the Sprint 9 definition of done. PR sequencing and review remain outside implementation completion.
