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
- [ ] Review and merge Sprint 11 PR #13 after PR #12.
- [ ] Review and merge Sprint 12 PR #14 after PR #13.
- [ ] Add production email delivery, identity administration, OIDC/SSO, SCIM, WebAuthn/passkeys, TOTP, and step-up authentication.
- [ ] Add distributed rate limiting, managed secret rotation, and risk-based authentication.
- [ ] Add managed cloud ObjectStorage, encryption-key management, malware scanning, quarantine, retention, and legal-hold controls.
- [ ] Implement production scanner-provider adapters, credential exchange, webhooks, and portal SDKs.
- [ ] Implement Billing-owned Pricing Schedule calculation, contract/promotion eligibility, and customer override resolution.
- [ ] Introduce the dedicated post-QC Billing command and transactional-outbox event defined by ADR-004.
- [ ] Generate invoices from approved frozen Product Resolution records, bundle invoice/shipping documents, and include invoices in statements.
- [ ] Migrate legacy Case Intake behind an internal Digital Intake command only after ADR-001 compatibility gates are satisfied.
- [ ] Refactor large intake route handlers into typed application services and repository interfaces.
- [ ] Evaluate read replicas, partitioning, connection-pooling proxies, and tenant-specific data residency when scale requires them.

## Completed — Sprint 12 Digital Intake Platform Foundation

- [x] Add unified automatic digital, manual digital, and physical submission records.
- [x] Require a versioned Smart Digital Prescription before acceptance.
- [x] Add fixed, implant, removable, orthodontic, appliance, and diagnostic validation rules.
- [x] Support multiple restorations, arches, teeth/units, implant positions, notes, attachments, and printable copies.
- [x] Add provider-neutral Scanner Provider contracts with explicit simulator and production-ready metadata.
- [x] Add Doctor Preference Profile administration with versioned clinical, material, production, routing, and outsource defaults.
- [x] Add Practice and tenant routing administration with verified precedence.
- [x] Add a price-free Product Catalog boundary and catalog-backed Product Resolution.
- [x] Remove customer-pricing columns from Product Catalog and establish separate Pricing Schedules.
- [x] Add pending Billing Review and product freezing on approval without moving pricing into Digital Intake.
- [x] Store STL, OBJ, PLY, CBCT, DICOM, X-ray, clinical photo, shade photo, ZIP, and prescription PDF objects through PostgreSQL-backed ObjectStorage.
- [x] Record communications, notifications, immutable audit, and immutable intake history.
- [x] Add Digital Intake and Intake Administration React workspaces.
- [x] Preserve legacy Case Intake compatibility and document the migration strategy in ADR-001.
- [x] Establish permanent ADR operating policy and ADRs 002–004.
- [x] Pass frozen install, strict TypeScript, production builds, migrations 0001–0006, rollback/reapplication, inherited integrations, Digital Intake integrations, Runtime Validation, and complete Playwright regressions.

## Completed — Sprint 11 Clinical Communications Platform

- [x] Add append-only communication threads, events, attachment references, and notifications.
- [x] Add chronological timelines, threaded history, tenant-scoped search, ObjectStorage attachments, and notification read state.
- [x] Integrate timelines into Practice, Doctor, Patient, Case, Shipment, and Invoice views.
- [x] Pass strict TypeScript, integrations, Runtime Validation, and complete Playwright regressions.

## Completed — Sprint 10 Production Identity & Security

- [x] Add PostgreSQL credentials, memberships, sessions, one-time tokens, password hashing, lockout, CSRF, authorization, tenant scope, and immutable security auditing.
- [x] Replace browser-local authentication authority with secure server sessions.
- [x] Pass final security CI, Runtime Validation, and complete Playwright regressions.

## Completed — Sprint 9 Infrastructure Core: Durable Persistence

- [x] Add tenant-aware PostgreSQL repositories, transactions, migrations, rollback, ObjectStorage, immutable audit, snapshot migration, and durable runtime composition.
- [x] Cut production ERP modules over to PostgreSQL and pass full browser regressions.
- [x] Achieve Community Preview 1 Beta.

## Completed — Sprints 3–8

- [x] Practice and Doctor Management.
- [x] Patient and Case Intake.
- [x] Production Workflow Engine.
- [x] Quality Control Engine.
- [x] Shipping & Logistics.
- [x] Billing & Financial Engine.
- [x] Preserve API-backed authentication, protected routes, session persistence, and browser regressions.
