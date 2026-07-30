# Sprint 13 — Platform Readiness & Commercialization Architecture

## Status

Architecture and planning only. No runtime ERP functionality, migrations, APIs, authentication flows, React components or user-interface behavior are implemented.

## Baseline

- Community Preview 2 commit: `735107e4de399df77c96823194e31f1089b7be90`
- Application version: `v0.2.0`
- Migration version: `0006`

## Commercial model

NorthStar is a multi-tenant SaaS platform sold to dental laboratories.

```text
NorthStar Platform
→ Platform Owner
→ Tenant: subscribing laboratory
→ Laboratory staff
→ Doctor Practices
→ Doctors and office staff
→ Future patient portal
```

Laboratories purchase subscriptions and own tenant configuration and branding. Practices and Doctors are customers of the laboratory, not tenants.

## Objective

Define the remaining platform capabilities required before broad customer deployment while preserving CP2 module boundaries, tenant isolation, security, PostgreSQL persistence, ObjectStorage, immutable audit, Communications, Digital Intake, Product Resolution, Billing and existing ERP workflows.

## Refined architectural domains

1. Multi-state Tax Engine and customer Tax Exemption Management
2. Platform Owner, laboratory tenant ownership, licensing and entitlements
3. White-Label Laboratory Platform and Doctor/office-user portal experience
4. Tenant Branding and Tenant Customization Studio
5. Demonstration and resettable Development/UAT environments
6. UAT, defect and certification governance
7. Workflow Engine architecture

## Deliverables

- `docs/PLATFORM_READINESS_ARCHITECTURE.md`
- `docs/TAX_ENGINE_ARCHITECTURE.md`
- `docs/PLATFORM_LICENSING_ARCHITECTURE.md`
- `docs/WHITE_LABEL_LABORATORY_PLATFORM_ARCHITECTURE.md`
- `docs/DEMO_AND_UAT_ARCHITECTURE.md`
- `docs/WORKFLOW_ENGINE_ARCHITECTURE.md`
- refined `docs/PROJECT_GOVERNANCE.md`
- ADR-006 through ADR-011, including refined ADR-008
- architecture diagrams, implementation roadmap and backlog sequencing

## Permanent constraints

- Every subscribing laboratory is an isolated tenant.
- Doctors, Practices and office staff are not tenants.
- Branding, custom domains, subscription entitlements and UI visibility never grant authorization.
- Platform Owner does not automatically receive tenant business-data access.
- Support access is explicit, time-limited and immutable-audit protected.
- Tax remains independent from Product Catalog, Pricing Schedules and Digital Intake.
- Billing owns invoices and consumes immutable tax determinations.
- Demo reset operations are absent from Production.
- UAT evidence is separate from operational Communications and security audit.
- Workflow Engine coordinates commands but does not own ERP source records.

## Definition of Done

Sprint 13 architecture is complete when documentation and ADRs consistently define laboratory-owned tenants, platform/tenant/Practice/Doctor boundaries, branding and customization ownership, security and isolation, domain models, integration contracts, failure behavior, implementation phases, UAT criteria and deferred work without claiming runtime implementation.

## Deferred implementation

All migrations, APIs, React workspaces, tax calculations, licensing enforcement, tenant customization runtime, portal authentication, custom domains, seed/reset tooling, UAT software and Workflow Engine execution are deferred to separately approved implementation sprints.