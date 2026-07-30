# Sprint 13 — Platform Readiness & Commercialization Architecture

## Status

Architecture and planning only. No runtime ERP functionality, migrations, APIs, or user-interface behavior are implemented in this sprint.

## Baseline

- Community Preview 2 commit: `735107e4de399df77c96823194e31f1089b7be90`
- Application version: `v0.2.0`
- Migration version: `0006`

## Objective

Define the remaining platform capabilities required before broad customer deployment while preserving the CP2 modular-monolith boundaries, security architecture, PostgreSQL persistence, ObjectStorage, immutable audit, Clinical Communications, Digital Intake, Product Resolution, Billing, and existing ERP workflows.

## Architectural domains

1. Tax Engine and Tax Exemption Management
2. Platform Owner, tenant ownership, licensing, subscriptions, and tier entitlements
3. White-label Doctor Portal
4. Demonstration and resettable test environments
5. User Acceptance Testing and certification governance
6. Workflow Engine architecture

## Deliverables

- `docs/PLATFORM_READINESS_ARCHITECTURE.md`
- `docs/TAX_ENGINE_ARCHITECTURE.md`
- `docs/PLATFORM_LICENSING_ARCHITECTURE.md`
- `docs/WHITE_LABEL_PORTAL_ARCHITECTURE.md`
- `docs/DEMO_AND_UAT_ARCHITECTURE.md`
- `docs/WORKFLOW_ENGINE_ARCHITECTURE.md`
- ADR-006 through ADR-011
- phased implementation roadmap and security review

## Constraints

- Tax calculation remains independent from Product Catalog and Digital Intake.
- Billing owns invoice totals and consumes immutable tax determinations.
- Platform licensing is a control-plane concern and may not bypass tenant authorization.
- Portal branding must not change clinical or billing data ownership.
- Demo reset operations are prohibited in Production.
- UAT evidence is release evidence, not operational clinical history.
- Workflow Engine coordinates state transitions but does not own domain records.
- Material architectural decisions require ADRs.

## Definition of Done

Sprint 13 architecture is complete when the documents and ADRs define domain ownership, data models, security boundaries, integration contracts, failure behavior, implementation phases, and deferred work without claiming unimplemented functionality.

## Deferred implementation

All migrations, APIs, React workspaces, external tax-provider adapters, portal authentication, licensing enforcement, seed-data tooling, UAT software, and workflow runtime implementation are deferred to separately approved implementation sprints.