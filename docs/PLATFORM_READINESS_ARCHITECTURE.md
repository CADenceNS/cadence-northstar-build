# Platform Readiness & Commercialization Architecture

## Purpose

This document defines the commercial and operational platform capabilities required after Community Preview 2 and before broad customer deployment. It is architecture only.

## Context map

```text
Platform Control Plane
  ├─ Platform Owners
  ├─ Tenant ownership
  ├─ Subscription and license state
  ├─ Tier entitlements
  └─ Tenant suspension/reactivation

Tenant Application Plane
  ├─ Identity and Authorization
  ├─ Digital Intake
  ├─ Workflow coordination
  ├─ Billing
  ├─ Tax determination
  ├─ Communications
  ├─ Audit
  └─ White-label portal

Release and Assurance Plane
  ├─ Demo/Test Data Management
  ├─ UAT plans and evidence
  ├─ Defect lifecycle
  └─ Release certification
```

## Domain ownership

| Domain | Owns | Must not own |
|---|---|---|
| Tax Engine | jurisdiction resolution, rate versions, tax determinations, reports | invoice lifecycle, product identity, customer pricing |
| Tax Exemption Management | certificates, effective periods, exemption decisions | tax rates, invoice state |
| Licensing | subscriptions, licenses, entitlements, tenant commercial state | tenant operational data |
| White-label Portal | branded external experience and portal sessions | tenant branding as authorization, core clinical records |
| Demo/Test Data | deterministic scenarios and reset orchestration | Production deletion capabilities |
| UAT | test plans, executions, defects, certification evidence | production workflow state |
| Workflow Engine | templates, transitions, assignments, queues, SLA timers | clinical, billing, shipping, or communication source records |

## Shared architectural rules

- Every record is tenant-scoped unless explicitly part of the Platform control plane.
- Platform control-plane access requires a dedicated Platform Owner permission and immutable audit.
- Tenant suspension blocks interactive and API access but preserves data and audit history.
- Cross-domain coordination uses application commands and events; no domain writes another domain’s tables directly.
- Historical decisions are append-only or versioned.
- External integrations are adapters behind stable internal ports.
- Idempotency keys are required for externally initiated commands and event consumers.
- Personally identifiable, clinical, tax-certificate, and licensing data use least-privilege access and explicit retention rules.

## Proposed implementation sequence

### Phase 13A — Operational readiness foundation

- environment metadata
- feature-flag foundation
- UAT plans, executions, defects, and release approvals
- deterministic demo/test data with Development/UAT reset controls

### Phase 13B — Platform control plane

- Platform Owner authorization
- tenant ownership
- subscriptions, licenses, entitlements, suspension/reactivation
- control-plane audit and operational dashboards

### Phase 13C — Tax foundation

- jurisdiction and rate-version repositories
- exemption certificate management
- tax determination command consumed by Billing
- Sales and Use Tax exports

### Phase 13D — Portal foundation

- branding profiles
- Doctor portal identity boundary
- tenant-aware portal sessions
- custom-domain verification architecture

### Phase 13E — Workflow Engine implementation

- template repository
- runtime instances
- state transitions
- queues and assignments
- SLA timers and event outbox

## Security review

- Platform Owner is not a tenant administrator and must explicitly assume a tenant support scope with reason, duration, and audit.
- License enforcement must fail closed for commercial entitlements while preserving emergency data export and administrative recovery paths.
- Tax certificates are sensitive business documents stored through ObjectStorage with authorized download endpoints.
- Portal sessions require separate audience, cookie, CSRF, rate-limit, and account-recovery policies.
- Demo resets require environment allowlists, two-step confirmation, an execution token, and immutable audit.
- Workflow transitions require server-side authorization and optimistic concurrency.

## Non-goals

This architecture does not implement tax calculation, licensing enforcement, portal login, demo reset, UAT software, or workflow execution.