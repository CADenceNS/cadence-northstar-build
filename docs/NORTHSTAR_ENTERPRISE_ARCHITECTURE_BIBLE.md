# NorthStar Enterprise Architecture Bible

## Status

Master technical reference for the NorthStar Laboratory Intelligence Platform. This edition is architecture-only and is anchored to Community Preview 2 commit `735107e4de399df77c96823194e31f1089b7be90`.

## 1. Platform vision

NorthStar is a secure, configurable, multi-tenant SaaS operating system for dental laboratories. The subscribing laboratory is the tenant. Practices, Doctors and office users are customers and delegated users of that laboratory. NorthStar Platform governs licensing, health and commercial controls without implicit access to tenant business data.

## 2. Architecture principles

- modular monolith before evidence-based service extraction;
- tenant isolation at every persistence, storage, queue, cache, event and analytical boundary;
- server-side authentication and authorization;
- source-domain ownership and application-command integration;
- immutable or versioned historical decisions;
- provider-neutral adapters;
- explicit data lineage and auditability;
- short-lived branches and exact-head validation;
- ADRs for material decisions;
- no AI authority without approved policy and explainability.

## 3. Platform hierarchy

```text
NorthStar Platform
  └─ Platform Owner / Commercial Control Plane
      └─ Tenant: subscribing dental laboratory
          ├─ Tenant Owner and laboratory staff
          ├─ Laboratory locations and departments
          ├─ Doctor Practices
          │   ├─ Doctors
          │   └─ Office users
          └─ Future patient access boundary
```

## 4. Core implemented domains through CP2

- Identity, sessions, CSRF and authorization
- Tenant-aware PostgreSQL repositories
- ObjectStorage and immutable security audit
- Practice, Doctor, patient and case management
- Production workflow, QC, shipping and Billing
- Clinical Communications operational history
- Digital Intake and Smart Digital Prescription
- Product Catalog, Product Resolution and routing administration
- Pricing Schedule foundation and Doctor Preferences

## 5. Planned platform domains

- Release assurance, UAT and demo data
- Platform Owner, licensing and subscriptions
- Tenant Customization Studio and branding
- Tax and exemption management
- Executive Command Center
- Enterprise Business Intelligence
- Financial Accounting
- White-Label Laboratory Platform
- Integration Platform
- Workflow Engine
- Disaster Recovery and Business Continuity

## 6. Security architecture

Identity authenticates actors. Authorization evaluates tenant, location, Practice, entity, role, permission and administrative override. Commercial entitlement and feature flags are independent checks. Platform support access requires explicit tenant approval, scope, reason, expiration and immutable audit. Sensitive exports and financial actions may require step-up authentication.

## 7. Multi-tenant architecture

Every operational record is tenant-scoped unless explicitly Platform control-plane data. Tenant context is mandatory in repositories, ObjectStorage, queues, caches, events, analytics and background jobs. Cross-tenant aggregation is de-identified and separately governed. Tenant deletion, export and recovery follow lineage-aware procedures.

## 8. Domain ownership map

| Domain | Owns | Does not own |
|---|---|---|
| Digital Intake | submissions and prescriptions | invoices or pricing |
| Product Resolution | billable product identity | customer price |
| Pricing Schedules | future pricing configuration | product identity |
| Billing | invoices, credits, payments, statements | tax rates or GL books |
| Tax | jurisdictions, rates, exemptions, determinations | invoices or journals |
| Accounting | ledgers, journals, periods, recognition | invoice workflow |
| Communications | operational communication history | security audit or chat presence |
| Workflow | orchestration templates and transitions | ERP source records |
| ECC/BI | KPI definitions and analytical projections | operational commands |
| Licensing | subscriptions and entitlements | tenant authorization |
| Portal | branded external experience | Practice/case ownership |
| Integration | adapters and delivery state | domain business rules |

## 9. Workflow architecture

Versioned immutable templates define states, guarded transitions, assignments, approvals, SLA policies and events. Instances reference domain aggregates. Domain services retain final authority. Queues are projections. Production async behavior requires transactional outbox, idempotency, retries and dead-letter review.

## 10. Tax and compliance

Tax is a provider-neutral determination domain with jurisdiction hierarchy, historical rate versions, exemption certificates, immutable line-level determinations and Sales/Use Tax reporting. Billing supplies taxable amounts and consumes determinations. Historical invoices retain the exact rate and exemption evidence used.

## 11. Financial accounting

Accounting is separate from Billing. It provides double-entry journals, chart of accounts, periods, fiscal years, revenue recognition, deferred revenue, AR/AP control accounts, deposits, close procedures and immutable corrections. Tenant laboratory books remain separate from NorthStar Platform subscription books.

## 12. Executive Command Center

The ECC presents role-authorized, tenant-isolated operational, quality, communication, financial, customer and capacity intelligence. KPI definitions are versioned and include formula, sources, cadence, retention, thresholds and drill-down contracts. Every value displays freshness and lineage.

## 13. Enterprise Business Intelligence

An analytical warehouse receives versioned data from source domains through outbox/CDC/extraction adapters. Governed facts, dimensions, time intelligence, snapshots and semantic metrics support the ECC and reports. The warehouse never becomes operational authority.

## 14. White-Label Laboratory Platform

Each laboratory controls business identity, visual tokens, document templates, communication templates, portal settings and future custom domains. Branding is presentation-only. Doctor and office users remain Practice-scoped. The Tenant Customization Studio is isolated from Platform Owner controls.

## 15. Integration Platform

REST, webhooks, imports, exports and provider adapters use stable versioned ports, tenant binding, least-privilege credentials, idempotency, signatures, replay protection, observability and dead-letter handling. Providers cannot write domain tables directly.

## 16. Disaster recovery

Backups, replication, RPO/RTO, tenant recovery, ObjectStorage recovery, database point-in-time recovery, queue replay, incident response and continuity exercises are governed by documented, tested procedures. Recovery evidence belongs to the assurance domain.

## 17. Testing and release governance

The lifecycle is Feature Development → Engineering Validation → Architectural Review → Release Candidate → Community Preview → Beta → General Availability → Maintenance. Required gates include frozen install, strict builds, migrations and rollback, integrations, security, Runtime Validation, Playwright, UAT, ADR review and exact-commit evidence.

## 18. Deployment architecture

Environments are Development, Integration, UAT and Production. Environment identity is server-owned. Production uses managed secrets, durable PostgreSQL, managed ObjectStorage, monitoring, backup, rate limiting, secure networking and controlled releases. Environment-specific credentials and data never cross boundaries without approved de-identification.

## 19. Coding standards

- strict TypeScript and validated contracts;
- parameterized SQL and repository boundaries;
- domain services over route-level business logic;
- stable event and API versions;
- no secrets, clinical content or internal object keys in logs;
- explicit error handling, idempotency and concurrency control;
- tests at unit, integration, migration, security, runtime and browser layers;
- documentation and ADRs updated with architecture changes.

## 20. ADR index

The canonical index is `docs/ADR/README.md`. Accepted ADRs are never deleted; replacements supersede prior decisions explicitly.

## 21. Roadmap

- Sprint 13A: Operational Readiness and Tenant Foundation
- Sprint 13B: Commercial Control Plane
- Sprint 13C: Tenant Customization Studio
- Sprint 13D: Tax and Compliance
- Sprint 13E: Executive Command Center, BI and Accounting Foundation
- Sprint 13F: White-Label Laboratory Platform
- Sprint 13G: Workflow Engine

## 22. Deferred implementation

This Bible does not claim implementation of the planned domains. Runtime work requires separately approved sprints, migrations, security review, tests, ADR conformance and release validation.