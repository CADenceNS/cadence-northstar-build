# CADence NorthStar Master Development Bible

## Authority

This document is the single engineering source of truth for current development status and continuity. Detailed architecture remains in the Enterprise Architecture Bible and ADRs; this Bible defines how approved architecture, implemented software, releases, UAT and future work remain synchronized.

Authoritative implementation baseline: `main` at RC1 merge commit `b05da10bb633bb48e51f08a9b10bef4a88d152a3`.

## Product vision

CADence NorthStar is a secure, configurable, multi-tenant SaaS operating and intelligence platform for dental laboratories. The subscribing laboratory is the tenant. Practices, Doctors and office users are customers and delegated users of that laboratory. NorthStar Platform governs licensing, health and commercial controls without automatic access to tenant business data.

## Product scope

NorthStar ERP owns laboratory operations from customer and case intake through production, QC, shipping, billing, communications, UAT evidence and operational reporting.

NorthStar does not own clinical diagnosis, licensed CAD engine internals, payment-provider settlement, external tax-provider rules, carrier systems or identity-provider internals. Those systems integrate through governed adapters.

## Platform boundaries

- NorthStar ERP and Design Studio are separate products.
- Billing owns invoices, payments, statements and AR; future Accounting owns ledgers and journals.
- Communications owns operational history; Security Audit owns security evidence.
- Product Catalog owns product identity; Pricing Schedules own customer pricing configuration.
- Operational dashboards read source-domain projections; future BI is analytical and cannot mutate ERP state.
- Workflow Engine will orchestrate domain commands but will not own source records.

## Current architecture

- Modular monolith with evidence-based service extraction.
- TypeScript pnpm monorepo.
- React web application.
- Express API composition.
- PostgreSQL as transactional system of record.
- Provider-neutral ObjectStorage with PostgreSQL-backed current implementation.
- Server-managed sessions, CSRF and centralized authorization.
- Immutable security audit and append-only Communications history.
- Versioned SQL migrations with rollback/reapplication validation.
- Playwright, integration and Runtime Validation gates.

## Module responsibilities

The canonical implementation/status catalog is `docs/MODULE_REGISTRY.md`. Every module must have one owning domain, documented dependencies and a declared status. A sprint may not silently create a second owner for the same responsibility.

## Coding standards

- Strict TypeScript; no untyped cross-domain payloads.
- Validate external and user-controlled inputs.
- Parameterized SQL only.
- Prefer application services and repositories over route-level business logic.
- Preserve tenant scope in persistence, storage, events, queues, caches and analytics.
- Never expose secrets, internal object keys, clinical content or credentials in logs.
- Posted, certified or historical records are corrected by versioning/reversal, not silent mutation.
- Provider integrations implement stable ports and may not write domain tables directly.
- UI changes must preserve approved layouts unless redesign is explicitly approved.
- Do not duplicate working modules to accelerate a sprint.
- Add or update tests with every behavioral change.
- Update MODULE_REGISTRY, ROADMAP and TECHNICAL_DEBT when scope or status changes.

## Repository structure

- `.github/workflows` — release and validation automation.
- `apps/api` — API composition, domain services, repositories, migrations and integration tests.
- `apps/web` — React shell and domain workspaces.
- `packages/shared` — shared contracts and validation primitives.
- `tests/e2e` — browser workflows and role certification.
- `docs/ADR` — permanent architectural decisions.
- `docs/SPRINTS` — sprint definitions and evidence.
- `docs/UAT` — business startup, credentials, walkthrough and readiness materials.
- `docs/RELEASES` — release notes and baseline manifests.
- `release` — machine-readable release manifests.

## Branch strategy

- `main` is the only authoritative integration branch.
- Start short-lived branches from current validated `main`.
- Naming: `feature/`, `fix/`, `chore/`, `docs/`, `release/`, `hotfix/`.
- Avoid stacked branches unless a written dependency plan is approved.
- Historical sprint branches are read-only traceability records.
- One PR should represent one bounded outcome.
- Exact-head validation is required before merge.
- Do not force-push validated release candidates without repeating certification.

## Pull request strategy

A PR must declare:

- objective and non-goals;
- modules changed;
- migrations and rollback impact;
- authorization and tenant-isolation impact;
- validation evidence;
- documentation and ADR changes;
- known limitations and deferred work.

No PR is complete because code exists. It is complete only when the exact head passes required validation and documentation registries are current.

## Release strategy

Official lifecycle:

Feature Development → Unit/Integration Tests → Sprint Validation → Engineering Reliability → Runtime Validation → Business UAT → Release Candidate Approval → Community Preview/Beta/GA → Maintenance.

Semantic milestones:

- Community Preview — internal feature-complete milestone.
- Beta — business users performing structured UAT.
- Release Candidate — feature freeze; fixes only.
- General Availability — production-ready supported release.

Every release must include human-readable notes and a machine-readable manifest recording version, commit, migration, workflows, feature flags, seed version, environments, deferred modules, breaking changes and rollback.

## UAT process

- UAT runs only against an identified build, commit and environment.
- Test plans contain acceptance criteria and expected results.
- Executions record Pass, Fail, Blocked or Not Run.
- Critical and High open defects block certification.
- Evidence must be tenant-scoped and auditable.
- Business observations, enhancements and workflow gaps remain separate from confirmed defects.
- Sprint 13B must not begin until RC1 Business UAT is reviewed and formally closed.

## Production release process

Before Production/GA:

1. Approved scope and architecture.
2. Frozen dependencies and strict builds.
3. Migration rehearsal and rollback qualification.
4. Security and tenant-isolation review.
5. Engineering Reliability and Runtime Validation.
6. Full browser regression.
7. Business UAT sign-off.
8. Backup/restore and incident-readiness evidence.
9. Release manifest and notes.
10. Approved deployment, monitoring and rollback window.

## Documentation hierarchy

1. `MASTER_DEVELOPMENT_BIBLE.md` — current continuity and governance.
2. `MODULE_REGISTRY.md` — module ownership and status.
3. `ROADMAP.md` — sequencing and milestone status.
4. `TECHNICAL_DEBT.md` — known debt and resolution ownership.
5. `ENGINEERING_DASHBOARD.md` — current executive engineering snapshot.
6. `NORTHSTAR_ENTERPRISE_ARCHITECTURE_BIBLE.md` — long-term technical architecture.
7. ADRs — permanent decisions.
8. Sprint, release and UAT documents — historical and execution evidence.

If documents conflict, current validated implementation plus accepted ADRs take precedence, and this Bible must be corrected immediately.

## Design Studio program

Design Studio is a separate product program. It owns CAD/visualization authoring experiences and design artifacts. NorthStar ERP owns business, case, workflow, security and operational records. Integration requires versioned contracts, explicit authorization, immutable provenance and no shared internal database tables. See `docs/DESIGN_STUDIO_PROGRAM.md`.

## Required future-sprint updates

Every sprint must update:

- Module Registry status and percentage;
- Roadmap category and sequencing;
- Technical Debt additions/resolutions;
- Engineering Dashboard current release/UAT status;
- ADR index when decisions change;
- release manifest for release candidates.