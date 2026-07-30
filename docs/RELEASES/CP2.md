# Community Preview 2 — v0.2.0

Recommended tag: `v0.2.0-cp2`

## New capabilities

### Clinical Communications Platform

- Immutable, chronological operational history for Practices, Doctors, patients, cases, shipments, and invoices.
- Threaded discussions with append-only corrections and version references.
- ObjectStorage-backed attachments without duplicated storage.
- In-application notifications and authorized communication search.
- Centralized entity authorization, Practice isolation, Doctor ownership checks, tenant-aware thread integrity, safe attachment metadata, and validated recipients.

### Digital Intake Platform Foundation

- Unified automatic digital, manual digital, and physical intake submissions.
- Mandatory Smart Digital Prescription with restoration-aware fields and validation.
- Provider-neutral Scanner Gateway abstraction.
- PostgreSQL-backed attachments and generated prescription copies.
- Production routing precedence and administration.
- Product Resolution with catalog-backed SKU and operational classification.
- Doctor Preference, Practice routing, tenant routing, Product Catalog, and Pricing Schedule administration foundations.
- Billing Review foundation with frozen product identities while Billing retains price and invoice ownership.

## Architecture

- Durable PostgreSQL persistence and migrations through version 0006.
- Production server sessions, CSRF protection, centralized authorization, and immutable security audit.
- Communications remain separate from security audit.
- Scanner Providers remain adapters outside the transactional intake domain.
- Product Catalog remains separate from Pricing Schedules.
- Product Resolution owns product identity; Billing owns pricing and invoices.
- Legacy Case Intake remains compatible pending an approved migration command.
- ADRs document legacy compatibility, catalog/pricing separation, scanner adapters, event-driven Billing Review, and Communications operational history.

## Security improvements

- HttpOnly server-side sessions and CSRF rotation.
- Tenant, Practice, Doctor, and applicable location authorization.
- Same-tenant cross-Practice communication denial.
- Safe ObjectStorage metadata with no internal key exposure.
- Active tenant-membership validation for notifications.
- Immutable operational and security records with minimized audit metadata.

## Validation summary

Community Preview 2 requires successful:

- frozen installation;
- strict TypeScript and production builds;
- migrations 0001–0006;
- migration rollback and reapplication;
- repository, security, Communications, and Digital Intake integration tests;
- secure runtime startup and API lifecycle;
- complete Playwright regression suite.

## Known deferred work

- Production scanner-vendor adapters and external portal webhooks.
- Managed cloud ObjectStorage, malware scanning, quarantine, retention, and legal holds.
- Authorized attachment-download endpoints and short-lived provider URLs.
- Pricing Schedule calculation and eligibility rules.
- Post-QC Billing command, transactional outbox, and intake-driven invoice generation.
- SSO, SCIM, MFA/passkeys, distributed rate limiting, and managed secret rotation.
- External communication providers, mentions, rich text, and retention exports.

## Technical debt

- Large Digital Intake route module should be separated into typed application services.
- Some domain handlers still access SQL directly rather than repositories.
- Repository-document compatibility and normalized tables coexist.
- Runtime Validation still contains legacy source-alignment and lockfile write behavior.
- Long-lived stacked PRs created avoidable integration risk.

## Governance after CP2

Use short-lived, focused branches; merge validated work regularly; establish Release Candidate feature freezes; tag stable Community Preview milestones; and require UAT and release approval before General Availability.
