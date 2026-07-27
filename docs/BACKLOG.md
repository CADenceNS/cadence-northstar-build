# Engineering Backlog

## Active

- [ ] Merge PR #2 after review.
- [ ] Review and merge PR #4 after PR #2.
- [ ] Review and merge PR #5 after PR #4.
- [ ] Review and merge PR #6 after PR #5.
- [ ] Review and merge PR #7 after PR #6.
- [ ] Review and merge PR #8 after PR #7.
- [ ] Review and merge PR #9 after PR #8.
- [ ] Inject PostgreSQL repositories into Authentication, Practice, Doctor, Patient, Case, Production, QC, Shipping, and Billing runtime services.
- [ ] Remove all production process-memory stores after parity and restart-persistence verification.
- [ ] Migrate base64 attachments and generated documents through `ObjectStorage` and persist only object metadata in PostgreSQL.
- [ ] Emit immutable audit events for every authenticated mutation and lifecycle transition.
- [ ] Add runtime relationship, concurrency, representative backfill, and restart-persistence tests.
- [ ] Replace development-only credentials with production identity and secure server sessions.
- [ ] Add server-side authorization enforcement for protected API resources.
- [ ] Add managed cloud object storage, encryption-key management, malware scanning, and retention controls.

## Sprint 9 — Infrastructure Core: Durable Persistence

- [x] Define typed repository contracts for all completed modules.
- [x] Add tenant-aware repository context and transaction registry.
- [x] Add PostgreSQL pool, transaction, and immutable audit infrastructure.
- [x] Add normalized PostgreSQL schema, constraints, indexes, soft deletes, financial decimal columns, and audit immutability trigger.
- [x] Add apply and rollback migrations.
- [x] Add provider-neutral object-storage interfaces with in-memory testing support.
- [x] Add a PostgreSQL-backed object-storage implementation.
- [x] Add a transactional versioned legacy-snapshot migration path.
- [x] Implement concrete PostgreSQL adapters for every repository contract.
- [x] Add durable repository-document compatibility storage with tenant isolation, versioning, indexes, and soft deletion.
- [x] Add PostgreSQL integration tests for tenant isolation, soft deletion, rollback, immutable audit events, and binary object persistence.
- [x] Add PostgreSQL migration apply/rollback/reapply CI coverage.
- [x] Preserve all existing Playwright browser regressions.
- [x] Update `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, and `docs/SPRINTS/Sprint-09.md`.
- [ ] Cut all running modules over to durable repositories.
- [ ] Route production attachments and generated documents through object storage.
- [ ] Emit production audit events for every required mutation.
- [ ] Verify PostgreSQL-backed dashboard parity and restart persistence.
- [ ] Mark Sprint 9 complete only after every validation gate passes.

## Completed — Sprint 8 Billing & Financial Engine

- [x] Define strict invoice, line, adjustment, payment, terms, statement, aging, and financial-metric contracts.
- [x] Add a `FinancialRepository` persistence boundary and in-memory implementation.
- [x] Generate invoices automatically when shipments are delivered.
- [x] Support multiple cases per invoice through multi-case shipments.
- [x] Add taxes, tax-exempt handling, discounts, credits, fees, payment terms, payment recording, AR aging, monthly statements, dashboard metrics, API endpoints, authenticated UI, and Playwright coverage.
- [x] Pass Sprint 8 validation and runtime regression pipelines.
- [x] Open focused Sprint 8 pull request #9 stacked on PR #8.

## Completed — Sprints 3–7

- [x] Practice and Doctor Management.
- [x] Patient and Case Intake.
- [x] Production Workflow Engine.
- [x] Quality Control Engine.
- [x] Shipping & Logistics.
- [x] Preserve API-backed authentication, protected routes, session persistence, and all browser regressions.
