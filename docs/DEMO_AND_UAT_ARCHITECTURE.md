# Demo, Test Data & UAT Architecture

## Purpose

Define deterministic multi-tenant demonstration environments and a permanent UAT certification framework without exposing destructive reset operations in Production.

## Environment and seed strategy

Development and UAT may host isolated synthetic laboratory tenants. Integration uses ephemeral or isolated datasets. Production never registers seed/reset commands. Seed packs are versioned, deterministic, idempotent and include schema version, application version, random seed, scenario IDs and checksum.

Sample identities cover Platform Owner, Tenant Owner/Administrator, all laboratory staff roles, Doctor and office-user portal roles, and read-only audit roles. Scenarios include Practice onboarding, digital/physical intake, implant review, production/QC, communications, shipping/billing, taxable/exempt accounts, licensing states, branding and portal journeys.

Reset requires environment allowlist, tenant/sandbox scope, authorization, typed confirmation, reason, snapshot reference, idempotency and immutable audit. It suspends tenant jobs, deletes approved sandbox data and objects, reapplies seeds, verifies checksums and resumes jobs. Failure leaves the sandbox locked.

## UAT domain model

- test plan and version;
- module acceptance suite;
- test case with preconditions, steps and expected result;
- execution with tester, environment, build, commit and evidence;
- ObjectStorage attachments;
- append-only comments;
- defect and lifecycle history;
- module and release approvals.

Defect lifecycle:

```text
New → Triaged → In Progress → Ready for Retest → Verified → Closed
                   └──────────────→ Reopened ──────────────┘
```

## Required evidence for every module

- authorized happy path;
- denied unauthorized path;
- same-tenant Practice isolation and cross-tenant isolation;
- persistence/restart behavior;
- validation and recovery behavior;
- immutable audit and operational-event evidence where applicable;
- browser evidence for critical workflows;
- migration, rollback or compensation evidence;
- performance and accessibility evidence where risk requires it;
- documented limitations and deferred work.

## Module acceptance matrix

| Module | Minimum acceptance criteria | Blocking defects | Exit evidence |
|---|---|---|---|
| Authentication | login, restoration, logout, lockout, recovery and session expiry behave securely | bypass, session fixation, credential disclosure | security integration plus browser lifecycle |
| Authorization | tenant, Practice, Doctor, role and admin scopes enforced on every command/query | any cross-tenant or unauthorized data access | negative integration and Playwright evidence |
| Digital Intake | automatic/manual/physical paths converge; prescription and attachments persist | case acceptance without required prescription; lost files | lifecycle, ObjectStorage and browser evidence |
| Communications | authorized append-only history, safe attachments and notifications | altered history, leaked object keys, unauthorized timeline | integration, audit and browser evidence |
| Production | routes, assignments, status history and SLA inputs remain consistent | invalid transition or lost assignment | domain and end-to-end evidence |
| QC | required inspections, outcomes, defects and release gates enforced | shipment after failed/blocked QC | QC integration and browser evidence |
| Shipping | packing, labels, tracking, delivery and invoice trigger compatibility | shipment of unauthorized/unreleased case | shipping and regression evidence |
| Billing | products, adjustments, invoices, payments and statements remain tenant-scoped | incorrect totals, duplicate invoice, cross-account data | financial integration and reconciliation |
| Tax | historical rates, exemption states, jurisdiction decisions and reports are reproducible | wrong jurisdiction/rate, expired certificate suppresses tax | determination fixtures and report reconciliation |
| Laboratory Platform Portal | branding isolation, Practice-only access, uploads, cases, communications and billing self-service | cross-Practice access, unsafe upload, tenant/domain confusion | portal security and browser suite |
| Licensing | lifecycle and entitlement gates follow defined order without granting authorization | unlicensed feature access or tenant-wide false suspension | control-plane integration and recovery tests |
| Branding | safe tokens/templates render consistently without executable injection | script/CSS injection or branding affecting authorization | sanitization, visual and document snapshots |
| Customization Studio | tenant admins manage only permitted tenant settings with version/audit history | Platform control exposure or cross-tenant configuration | CRUD, authorization and audit evidence |
| Workflow Engine | versioned templates, guarded transitions, queues, approvals and SLA events are deterministic | state corruption, duplicate transition, domain bypass | concurrency, outbox, replay and browser evidence |

## Certification exit criteria

- all required cases executed on the exact release build;
- no open Critical or High defects;
- Medium defects have approved disposition;
- Runtime Validation and complete Playwright pass on the same commit;
- migration and rollback evidence is current;
- Engineering, QA, Operations, Product Owner and Administrator approvals complete;
- release notes, ADRs, manifest, security review and deferred work current;
- tenant-isolation suite passes for every newly introduced domain.

## Security

UAT uses synthetic or formally de-identified data. Test credentials are environment-specific. Defects exclude secrets and unnecessary clinical content. Attachments use ObjectStorage safe paths. Reset operations are absent from Production.

## Deferred

Runtime UAT/defect modules, seed generators, snapshot providers, automated certification and reset workers remain deferred.