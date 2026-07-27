# Engineering Backlog

## Active

- [ ] Merge PR #2 after review.
- [ ] Review and merge PR #4 after PR #2.
- [ ] Review and merge PR #5 after PR #4.
- [ ] Review and merge PR #6 after PR #5.
- [ ] Review and merge PR #7 after PR #6.
- [ ] Review and merge PR #8 after PR #7.
- [ ] Review and merge PR #9 after PR #8.
- [ ] Review and merge PR #10 after PR #9.
- [ ] Review and merge architecture-planning PR #11 after PR #10.
- [ ] Review and merge Sprint 10 PR #12 after PR #11.
- [ ] Complete Sprint 11 communications integration, CI, Runtime Validation, and Playwright gates.
- [ ] Add production email delivery for password reset and email verification.
- [ ] Add user, membership, session, and role administration workflows.
- [ ] Add future OIDC/SSO, SCIM, WebAuthn/passkey, TOTP, and step-up authentication integrations.
- [ ] Add distributed rate limiting, managed secret rotation, and risk-based authentication controls.
- [ ] Add managed cloud object storage, encryption-key management, malware scanning, and retention controls.
- [ ] Add durable generation and cloud storage for invoice PDFs and shipping documents when those existing domains begin producing binary artifacts.
- [ ] Evaluate read replicas, partitioning, connection-pooling proxies, and tenant-specific data residency when operational scale requires them.

## Sprint 11 — Clinical Communications Platform

- [x] Add append-only communication threads, events, attachment references, and notifications schema.
- [x] Add chronological timeline and threaded-history APIs.
- [x] Add ObjectStorage-backed communication attachments without duplicating binary storage.
- [x] Add tenant-scoped communication search by entity, actor, date, event type, and keyword.
- [x] Add notification retrieval, priority/category targeting, unread state, and read transitions.
- [x] Integrate timelines into Practice, Doctor, Patient, Case, Shipment, and Invoice views.
- [x] Add an authenticated in-application notification center.
- [x] Add communication repository, ordering, attachment, search, notification, and authorization integration coverage.
- [x] Add dedicated Sprint 11 validation workflow and Runtime Validation migration support.
- [ ] Pass strict TypeScript and production builds on final head.
- [ ] Pass Sprint 11 integration and migration rollback/reapplication gates.
- [ ] Pass Runtime Validation and complete Playwright regressions on final head.
- [ ] Mark Sprint 11 complete only after all acceptance gates pass.

## Completed — Sprint 10 Production Identity & Security

- [x] Add PostgreSQL credential, membership, session, and one-time-token schema with rollback.
- [x] Replace plaintext password comparison with salted, parameterized `scrypt` verification.
- [x] Add HttpOnly server-side sessions with idle and absolute expiry, revocation, device metadata, and concurrency limits.
- [x] Add temporary account lockout and immutable authentication failure audits.
- [x] Add CSRF protection, proxy-aware same-origin validation, and CSRF rotation on session restoration.
- [x] Add centralized request identity, permission evaluation, practice scope enforcement, and stable security errors.
- [x] Add role coverage for administrators, laboratory operations, Doctor users, and read-only auditors.
- [x] Replace browser-local authentication authority with server session restoration and logout invalidation.
- [x] Add security integration tests and dedicated Sprint 10 validation workflow.
- [x] Pass final Sprint 10 CI, Runtime Validation, and the complete Playwright suite.
- [x] Add `docs/SECURITY.md`, `docs/AUTHORIZATION.md`, and `docs/SPRINTS/Sprint-10.md`.

## Completed — Sprint 9 Infrastructure Core: Durable Persistence

- [x] Define typed repository contracts for Authentication, Practice, Doctor, Patient, Case, Production, QC, Shipping, Financial, and Audit domains.
- [x] Add tenant-aware repository context and cross-repository transaction support.
- [x] Add PostgreSQL pool, transaction, migration, rollback, and immutable audit infrastructure.
- [x] Add normalized PostgreSQL schemas, constraints, indexes, soft deletion, versioning, and financial decimal columns.
- [x] Implement concrete PostgreSQL adapters for every production repository contract.
- [x] Add durable repository-document compatibility storage preserving verified Sprint 8 payloads.
- [x] Add provider-neutral `ObjectStorage` with PostgreSQL-backed production storage and in-memory test storage.
- [x] Persist case files and QC photographs through `ObjectStorage` while preserving backward-compatible API payloads.
- [x] Cut Authentication, Practice, Doctor, Patient, Case, Production, QC, Shipping, Billing, and dashboard metrics over to PostgreSQL.
- [x] Remove the legacy array-backed server from the production import graph.
- [x] Emit append-only audit events for authentication, master-data changes, case lifecycle, production, QC, shipping, and financial events.
- [x] Prevent duplicate audit records during internal QC and shipping case synchronization.
- [x] Add legacy snapshot migration and representative relationship, transaction, tenant-isolation, soft-delete, binary-object, and audit integration tests.
- [x] Verify migration application, destructive rollback, and reapplication against PostgreSQL 16.
- [x] Verify operational data, relationships, object bytes, audit history, and dashboard metrics survive API process termination and restart.
- [x] Run the complete Sprints 3–8 Playwright regression suite exclusively against the PostgreSQL-backed runtime.
- [x] Update `docs/SPRINTS/Sprint-09.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, and CP1 Beta release documentation.
- [x] Achieve the Community Preview 1 Beta durable-persistence milestone.

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
