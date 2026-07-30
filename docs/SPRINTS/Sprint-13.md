# Sprint 13 — Enterprise Intelligence & Commercial Platform Architecture

## Status

Architecture and planning only. No runtime ERP functionality, migrations, APIs, authentication changes, React components or UI behavior are implemented.

## Baseline

- Community Preview 2 commit: `735107e4de399df77c96823194e31f1089b7be90`
- Application version: `v0.2.0`
- Migration version: `0006`

## Commercial model

NorthStar is a multi-tenant SaaS Laboratory Intelligence Platform sold to dental laboratories. Each subscribing laboratory is a tenant; Practices, Doctors and office staff are tenant customers and delegated users.

## Objective

Complete the remaining enterprise architecture required for broad commercialization while preserving CP2 behavior and approved domain boundaries.

## Architectural domains

1. Operational Readiness, Demo Data, UAT and release assurance
2. Platform Owner, laboratory tenant ownership, licensing and entitlements
3. Tenant Customization Studio and White-Label Laboratory Platform
4. Tax Engine and exemption management
5. Executive Command Center and KPI framework
6. Enterprise Business Intelligence and analytical warehouse
7. Financial Accounting foundation
8. Integration Platform
9. Disaster Recovery and Business Continuity
10. Workflow Engine architecture

## Deliverables

- `docs/PLATFORM_READINESS_ARCHITECTURE.md`
- `docs/EXECUTIVE_COMMAND_CENTER_ARCHITECTURE.md`
- `docs/BUSINESS_INTELLIGENCE_ARCHITECTURE.md`
- `docs/ACCOUNTING_ARCHITECTURE.md`
- `docs/INTEGRATION_PLATFORM_ARCHITECTURE.md`
- `docs/DISASTER_RECOVERY_ARCHITECTURE.md`
- `docs/NORTHSTAR_ENTERPRISE_ARCHITECTURE_BIBLE.md`
- Tax, Licensing, White-Label Laboratory Platform, Demo/UAT and Workflow architecture documents
- refined Project Governance and backlog
- ADR-006 through ADR-015

## Executive design requirements

The Executive Command Center must answer laboratory performance, quality, customer growth/decline, financial and tax obligations, operational bottlenecks, turnaround/SLA performance and emerging trends. Executives may drill from aggregate KPIs to source records only through role-appropriate tenant authorization.

## Permanent constraints

- every laboratory is an isolated tenant;
- ECC/BI is analytical and cannot mutate operational ERP state;
- Accounting owns ledgers while Billing owns invoice workflow;
- Tax owns determinations while Billing owns taxable transaction amounts;
- integrations remain adapters behind stable ports;
- Platform Owner has no implicit tenant-data access;
- branding, entitlements and dashboards never grant authorization;
- recovery requires tested restores and tenant-aware evidence;
- Workflow Engine coordinates commands but does not own source records;
- forecasts and AI insights remain explainable and separate from historical facts.

## Implementation roadmap

- Sprint 13A — Operational Readiness and Tenant Foundation
- Sprint 13B — Commercial Control Plane
- Sprint 13C — Tenant Customization Studio
- Sprint 13D — Tax and Compliance
- Sprint 13E — Executive Command Center, Business Intelligence and Accounting Foundation
- Sprint 13F — White-Label Laboratory Platform
- Sprint 13G — Workflow Engine

## Definition of Done

Sprint 13 architecture is complete when documentation and ADRs define domain ownership, tenant isolation, KPI formulas and lineage, analytical and accounting models, integration and recovery boundaries, security, implementation sequencing, UAT expectations and deferred work without claiming runtime implementation.

## Deferred implementation

All migrations, APIs, React workspaces, dashboards, warehouse pipelines, accounting ledgers, integrations, recovery automation, tax calculations, licensing enforcement, portal runtime, UAT software and Workflow execution remain deferred to separately approved implementation sprints.