# Platform Readiness & Commercialization Architecture

## Purpose

This document defines NorthStar as an enterprise multi-tenant SaaS operating platform for independent dental laboratories. It refines the Community Preview 2 architecture only; it does not implement runtime behavior.

## Commercial and identity hierarchy

```text
NorthStar Platform
└─ Platform Owner
   └─ Tenant: subscribing dental laboratory
      ├─ Tenant Owner / Tenant Administrator
      ├─ Laboratory staff
      │  ├─ Customer Service
      │  ├─ Production / CAD / Ceramics
      │  ├─ QC / Shipping / Accounting / Sales
      │  └─ Management
      └─ Doctor Practices: customers of the laboratory
         ├─ Doctors
         ├─ Doctor office staff
         └─ Future patient portal users
```

The laboratory purchases the subscription and owns the tenant configuration and branded experience. A Practice is a customer account inside one laboratory tenant. A Doctor is a professional user associated with one or more authorized Practices. Doctors, office staff, and patients are never tenants merely because they use a portal.

## Context map

```text
Platform Control Plane
  ├─ Platform Owners
  ├─ Tenant provisioning and ownership
  ├─ Subscription, license and entitlement state
  ├─ Platform feature flags and health
  └─ Time-limited tenant support grants

Tenant Application Plane — one isolated laboratory
  ├─ Tenant identity and authorization
  ├─ Tenant Customization Studio
  ├─ Practice and Doctor customer management
  ├─ Digital Intake and Smart Digital Prescription
  ├─ Production, QC, Shipping and Billing
  ├─ Product Resolution, Tax and Pricing foundations
  ├─ Communications and Audit
  ├─ Workflow coordination
  └─ White-Label Laboratory Platform experience

Release and Assurance Plane
  ├─ Environment metadata
  ├─ Demo/Test Data Management
  ├─ UAT plans, executions and defects
  └─ Release certification
```

## Ownership boundaries

| Boundary | Owns | Must not own |
|---|---|---|
| NorthStar Platform | service governance, platform health, tenant provisioning, global commercial policy | unrestricted tenant business data |
| Laboratory tenant | operational data, branding, configuration, staff, customer Practices and commercial settings | platform-global licensing policy |
| Practice | laboratory customer account, Doctors, office users, addresses and account preferences | tenant administration or another Practice’s records |
| Doctor | authorized professional identity and Practice relationships | tenant ownership |
| Office staff | delegated Practice tasks and portal permissions | Doctor clinical authority unless explicitly delegated |
| Tenant Customization Studio | tenant presentation and operational configuration | Platform Owner controls or authorization decisions |
| Tax Engine | jurisdiction resolution, rate versions, exemptions, determinations and reports | invoice lifecycle, product identity or customer pricing |
| Licensing | subscriptions, licenses, entitlements and tenant commercial state | tenant clinical or financial records |
| Workflow Engine | templates, transitions, queues, assignments and SLA orchestration | source records owned by ERP domains |

## Tenant isolation and scale

NorthStar must support hundreds of independent laboratories concurrently. Every tenant-owned record, object, event, report, workflow projection and configuration must carry an immutable tenant boundary. Tenant resolution occurs from authenticated membership and trusted host/domain binding, never from user-supplied identifiers alone.

Required controls:

- tenant-scoped database access and repository contracts;
- tenant-scoped ObjectStorage ownership and download authorization;
- tenant-scoped encryption, retention and export policy where applicable;
- no cross-tenant cache keys, queues, sessions, analytics or search results;
- per-tenant quotas and rate limits without weakening global platform protection;
- auditable support grants for any Platform Owner access to tenant data;
- background jobs and events carrying tenant identity and idempotency keys.

## Tenant Customization Studio

Each laboratory receives a tenant-only administrative control center containing:

- Business Profile and support contacts;
- Branding and portal presentation;
- Financial and Tax settings;
- Payment methods and invoice numbering;
- Turnaround times, Shipping and Pickup scheduling;
- Materials, Product Catalog and Pricing Schedules;
- Clinical preferences and Scanner integrations;
- Notification and communication templates;
- Security policies and Doctor registration policies;
- Portal settings and document templates.

The Studio cannot access Platform Owner licensing, platform health, global feature rollout or other tenants. Branding and configuration are presentation or operational inputs only; authorization always uses server-side identity, role, Practice and tenant policies.

## Role-specific tenant workspaces

- Customer Service: Practice onboarding, intake exceptions, pickup and communication queues.
- Production/CAD/Ceramics: authorized production queues, files, assignments and SLAs.
- QC: inspection queues, defects, holds and release decisions.
- Shipping: packing, labels, pickups, tracking and delivery.
- Accounting: billing review, invoices, statements, payments, tax and exemptions.
- Sales: prospect/customer relationship workflows with restricted financial visibility.
- Management: tenant analytics, capacity, quality, financial and operational oversight.
- Tenant Owner/Administrator: users, configuration, security, licensing visibility and Customization Studio.

## Shared architectural rules

- Cross-domain coordination uses commands and versioned events; no domain writes another domain’s tables.
- Historical financial, tax, licensing and workflow decisions are immutable or versioned.
- External providers remain adapters behind stable ports.
- Commercial entitlement never grants security authorization.
- Presentation branding never influences tenant or Practice access.
- Platform support access requires explicit reason, scope, approval, expiration and immutable audit.

## Revised implementation roadmap

### Sprint 13A — Operational Readiness and tenant foundation

Environment metadata, feature flags, UAT/defects/releases, deterministic demo data, tenant hierarchy contracts and tenant-branding schema design.

### Sprint 13B — Commercial control plane

Platform Owner, tenant provisioning, ownership, subscription states, licensing, entitlements, suspension/reactivation and support grants.

### Sprint 13C — Tenant Customization and branding foundation

Business profile, branding tokens, document/communication template configuration, portal settings and tenant-scoped administrative policies.

### Sprint 13D — Tax and compliance foundation

Jurisdictions, historical rates, exemption certificates, determinations, reports and Billing command integration.

### Sprint 13E — White-Label Laboratory Platform

Laboratory-branded portal identity, Practice/Doctor/office-user access, website integration, secure portal sessions and future custom domains.

### Sprint 13F — Workflow Engine implementation

Versioned templates, runtime instances, transitions, queues, assignments, approvals, SLA timers and transactional outbox.

## Security review

- Platform Owner is not a tenant administrator.
- Tenant support grants are least-privilege, time-limited and fully audited.
- Doctors and office users can access only authorized Practice records within one laboratory tenant.
- Custom domains and branding select presentation context but never grant access.
- Tenant suspension preserves data and restricted recovery/export paths.
- Tax certificates and tenant branding assets use ObjectStorage with safe metadata and authorized downloads.
- Demo reset commands are absent from Production.

## Non-goals

No tax calculation, licensing enforcement, tenant customization runtime, portal login, custom-domain provisioning, UAT software, demo reset or Workflow Engine execution is implemented by this architecture refinement.