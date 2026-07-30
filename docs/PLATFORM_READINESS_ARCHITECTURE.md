# Platform Readiness & Commercialization Architecture

## Purpose

This document defines NorthStar as an enterprise multi-tenant SaaS Laboratory Intelligence Platform for independent dental laboratories. It refines the Community Preview 2 architecture only; it does not implement runtime behavior.

## Commercial and identity hierarchy

```text
NorthStar Platform
└─ Platform Owner
   └─ Tenant: subscribing dental laboratory
      ├─ Tenant Owner / Tenant Administrator
      ├─ Laboratory staff and locations
      └─ Doctor Practices: laboratory customers
         ├─ Doctors
         ├─ Doctor office staff
         └─ Future patient portal users
```

The laboratory purchases the subscription and owns the tenant configuration, operational data, financial books and branded experience. Practices, Doctors and office staff are delegated tenant customers and users, not tenants.

## Context map

```text
Platform Control Plane
  ├─ Tenant provisioning, subscriptions, licensing and entitlements
  ├─ Platform feature rollout, health and analytics
  └─ Explicit time-limited tenant support grants

Tenant Application Plane
  ├─ Identity, authorization and Tenant Customization Studio
  ├─ Practices, Doctors, Digital Intake and Smart Prescription
  ├─ Production, QC, Shipping, Billing, Tax and Accounting
  ├─ Communications, Audit and Workflow orchestration
  ├─ White-Label Laboratory Platform
  └─ Executive Command Center

Enterprise Intelligence Plane
  ├─ KPI definitions and semantic metrics
  ├─ Tenant-isolated analytical warehouse
  ├─ historical snapshots, cubes and time intelligence
  └─ forecasting and explainable AI extension points

Integration Plane
  ├─ REST, webhooks, imports and exports
  └─ accounting, shipping, payments, tax, scanner, AI, notification and identity adapters

Release, Assurance and Continuity Plane
  ├─ environment metadata, demo data and UAT
  ├─ defects, approvals and release certification
  └─ backup, disaster recovery and business continuity evidence
```

## Domain ownership

| Domain | Owns | Must not own |
|---|---|---|
| Tenant laboratory | operational data, staff, customer Practices, configuration and branding | platform-global commercial policy |
| ECC | KPI definitions, dashboards, targets, alerts, analytical snapshots and exports | operational ERP commands |
| Business Intelligence | analytical facts, dimensions, lineage and semantic metrics | source-domain records |
| Accounting | chart of accounts, journals, periods, recognition and close | invoice workflow or pricing |
| Billing | invoices, credits, payments and statements | tax rates or general ledger |
| Tax | jurisdictions, rates, exemptions and determinations | invoice lifecycle or journals |
| Integration Platform | adapters, mappings, delivery state and credentials references | domain business rules or direct table writes |
| Disaster Recovery | recovery policy, evidence, restore procedures and continuity exercises | normal operational ownership |
| Licensing | subscriptions, entitlements and tenant commercial state | tenant authorization or business data |
| Workflow | templates, transitions, queues, assignments and SLA orchestration | ERP source records |

## Tenant isolation and commercial scale

NorthStar must support hundreds of laboratories concurrently. Every tenant record, object, event, report, KPI, warehouse row, workflow projection, queue message, cache key and integration job carries immutable tenant identity. Platform aggregate analytics are separately governed and de-identified. Platform support access to tenant data requires explicit reason, scope, approval, expiration and immutable audit.

## Executive intelligence principles

- every KPI has a business definition, formula, source lineage, cadence, retention and thresholds;
- every displayed value shows freshness and definition version;
- drill-down resolves through authorized source-domain query services;
- historical certified snapshots are restated explicitly rather than silently overwritten;
- forecasts and AI insights remain separate from historical facts and identify model, evidence and confidence;
- exports are tenant-scoped, authorized and audited.

## Tenant Customization Studio

Each laboratory configures Business Profile, Branding, financial/tax settings, payment methods, invoice numbering, turnaround, shipping, materials, Product Catalog, Pricing Schedules, clinical preferences, scanner integrations, notifications, security policies, portal settings, registration policies, support contacts and document templates. The Studio cannot access Platform Owner controls or other tenants.

## Shared rules

- no domain writes another domain's tables;
- cross-domain coordination uses authorized commands and versioned events;
- external services remain adapters behind stable ports;
- commercial entitlement and branding never grant authorization;
- historical financial, tax, accounting, licensing, workflow and KPI decisions are immutable or versioned;
- asynchronous production integration requires idempotency, transactional outbox, retries and dead-letter review;
- recovery is proven through restore testing, not backup status alone.

## Implementation roadmap

### Sprint 13A — Operational Readiness and Tenant Foundation
Environment awareness, feature flags, UAT, demo data, release approvals and tenant-isolation test harnesses.

### Sprint 13B — Commercial Control Plane
Platform Owner, tenant provisioning, subscriptions, licensing, entitlements, suspension/reactivation and support grants.

### Sprint 13C — Tenant Customization Studio
Business profile, branding, portal configuration, document/communication templates and tenant policies.

### Sprint 13D — Tax and Compliance
Jurisdictions, historical rates, exemption certificates, determinations, Sales/Use Tax reporting and Billing integration.

### Sprint 13E — Executive Command Center, BI and Accounting Foundation
KPI registry, analytical snapshots, tenant warehouse, production/quality/customer/financial intelligence, chart of accounts, journals, periods and reporting foundations.

### Sprint 13F — White-Label Laboratory Platform
Doctor/office-user experience, website integration, payments, Communications and future custom domains.

### Sprint 13G — Workflow Engine
Versioned templates, runtime, queues, approvals, SLA timers, events, outbox and automation controls.

## Non-goals

No ECC dashboard, KPI calculator, warehouse, accounting ledger, integration runtime, disaster-recovery tooling, tax calculation, licensing enforcement, portal runtime, UAT software or Workflow Engine execution is implemented by this architecture sprint.