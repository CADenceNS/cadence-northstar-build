# CADence NorthStar Repository Status Report

## Audit baseline

- Repository: `CADenceNS/cadence-northstar-build`
- Authoritative branch: `main`
- RC1 integration commit: `b05da10bb633bb48e51f08a9b10bef4a88d152a3`
- Current product version: `0.13.0`
- Current migration version: `0007`
- Current release state: Business UAT Release Candidate 1
- Validation inherited from certified PR #18: Runtime Validation passed, Sprint 13A Validation passed, Playwright 23/23 passed.

## Repository architecture

NorthStar is a TypeScript/pnpm modular monorepo with:

- `apps/api` — Express API, security composition, domain endpoints, PostgreSQL repositories, migrations, ObjectStorage, UAT services and integration tests.
- `apps/web` — React application shell, role-aware navigation, operational workspaces, Executive Command Center preview and UAT workspace.
- `packages/shared` — shared TypeScript contracts and validation boundaries.
- `tests/e2e` — Playwright browser regression and RC1 role/UAT certification.
- `docs` — architecture, ADRs, release governance, sprint records, UAT materials and operating policies.
- `release` — machine-readable release manifests.
- `.github/workflows` — Sprint and Runtime validation pipelines.

## Completed and active modules

| Module | Status | Notes |
|---|---|---|
| Authentication and server sessions | Active / UAT validated | Secure login, logout, session restoration, CSRF, timeout, remember-device and UAT password reset. |
| Authorization and tenant scoping | Active / UAT validated | Tenant, role, Practice and entity boundaries; administrative override remains explicit. |
| Practice and Doctor management | Active / UAT validated | Durable CRUD, account numbering, search and relationships. |
| Patient and Case Intake | Active / UAT validated | Durable clinical intake, attachments, turnaround and workflow linkage. |
| Production | Active / UAT validated | Department queues, assignments, status history and operational metrics. |
| Quality Control | Active / UAT validated | Templates, inspections, outcomes, defects, photos, remake and repair evidence. |
| Shipping and logistics | Active / UAT validated | Packing, shipments, tracking, delivery and pickup foundations. |
| Billing and financial operations | Active / UAT validated | Invoices, payments, statements, AR and dashboard data; not a General Ledger. |
| Communications | Active / UAT validated | Immutable operational history, threads, notifications and entity authorization. |
| Digital Intake | Active / UAT validated | Scanner abstraction, Smart Digital Prescription, Product Resolution and routing. |
| ObjectStorage | Active / UAT validated | PostgreSQL-backed provider-neutral storage; cloud provider and malware controls deferred. |
| UAT workspace and defect management | Active / RC1 | Plans, cases, executions, defects, evidence and readiness calculations. |
| Executive Command Center preview | Active / RC1 preview | Operational cards and implemented-data visualizations; not warehouse-backed BI. |
| Feature flags and environment metadata | Active / RC1 | Tenant-aware UAT gating and system/build information. |
| Deterministic UAT simulation | Active / Development/UAT only | Keramos and Sample Laboratory A personas and synthetic operational data. |

## Architecture-approved but not implemented

- Platform Owner commercial control plane
- Licensing, subscriptions and entitlements
- Tenant Customization Studio and full branding runtime
- Tax Engine and exemption certificate runtime
- Enterprise BI warehouse and certified KPI snapshots
- General Ledger and accounting periods
- Full White-Label Laboratory Platform
- Workflow Engine runtime
- Integration Platform runtime
- Disaster Recovery automation

These are not placeholders to be presented as complete. Their designs are governed by Sprint 13 architecture and ADR-006 through ADR-015.

## Experimental and simulation-only components

- Platform Owner, Tenant Owner, Tenant Administrator and Office Staff UAT personas mapped to existing authorization roles.
- Sample Laboratory A demonstrates login, dashboard/UAT isolation and secure denial, but not full tenant-native ERP CRUD.
- Executive Command Center uses operational read models rather than an analytical warehouse.
- UAT password reset returns a development token only in Development/UAT.
- Deterministic seed/reset behavior is prohibited in Production.

## Deprecated or superseded code paths

- Historical in-memory persistence implementations are superseded by PostgreSQL production composition and must not be reintroduced.
- Browser localStorage authentication is superseded by server-managed sessions.
- Historical stacked branches and PRs #1–#14 are superseded by the Community Preview 2 consolidation and remain only for traceability.
- Legacy Case Intake remains supported for compatibility; it is not deprecated until an approved migration command and transition plan exist.

## Duplicate-functionality review

No active duplicate ERP domain was identified. Areas requiring continued boundary discipline:

- Billing versus future Accounting: Billing owns invoice workflow; Accounting will own ledgers.
- Operational dashboards versus future BI: operational read models remain source-domain projections; BI will be analytical only.
- Communications versus security audit: operational history and immutable security audit remain separate.
- Product Catalog versus Pricing Schedules: product identity remains price-free; customer pricing remains separate.
- NorthStar ERP versus Design Studio: separate products with versioned integration contracts only.

## Placeholder, stub and deferred-service review

Known provider-neutral boundaries without production adapters:

- scanner providers beyond simulators
- cloud ObjectStorage
- payment, shipping, tax and accounting providers
- email, SMS, push and CTI providers
- OIDC/SAML/SCIM identity providers
- AI services
- background-job broker and transactional outbox runtime

These are intentional extension ports, not completed provider integrations.

## Technical debt summary

High priority:

- Complete hands-on Business UAT before Sprint 13B.
- Eliminate version inconsistency between repository package version `0.3.0` and RC1 build/release version `0.13.0` through an approved version policy.
- Replace `latest` Playwright dependency with a controlled version.
- Formalize an Engineering Reliability validation stage.
- Establish a hosted UAT environment or a business-friendly packaged launcher.

Medium priority:

- Split large API route modules into typed application services and repositories.
- Replace remaining direct SQL in route handlers.
- Add managed ObjectStorage, malware scanning, retention and legal holds before GA.
- Add production notification delivery and account administration.
- Add transactional outbox before asynchronous cross-domain workflows.

Low or evidence-triggered:

- Read replicas, partitioning, pooling proxies and tenant-specific data residency.
- Service extraction from the modular monolith.

## Active work and branches

At the audit point:

- PR #18 was the only active pull request and was merged as the RC1 baseline.
- `chore/engineering-continuity-baseline` is the only new governance work branch created by this sprint.
- Historical feature and release branches may remain for traceability but must not be treated as development bases.

## Continuity rule

All future branches must start from the latest validated `main` commit or an explicitly tagged release baseline. Historical sprint branches are read-only records and must never be used as a development base.