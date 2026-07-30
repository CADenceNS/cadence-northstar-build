# Platform Owner, Laboratory Tenant Ownership & Licensing Architecture

## Purpose

Define NorthStar’s commercial control plane for a SaaS platform sold to dental laboratories. A subscribing laboratory is the tenant. Practices, Doctors, office users and future patients are tenant customers or delegated users, not subscribers or tenants.

## Roles and ownership

### Platform Owner

Administers the NorthStar service: tenant provisioning, subscriptions, licenses, global feature rollout, platform health, commercial policy, emergency operations and support grants. Platform Owner status does not automatically grant tenant business-data access.

### Tenant Owner

Represents the subscribing laboratory’s ownership authority. Controls the commercial relationship, designated tenant administrators, billing contacts, branding authority, export authority and approval of support access.

### Tenant Administrator

Manages laboratory users, tenant configuration, security policies and operational setup within granted permissions. It cannot alter platform-global contracts or Platform Owner controls.

### Practice, Doctor and office users

A Practice is a laboratory customer account. Doctors and office users receive tenant-scoped portal memberships. They cannot administer the laboratory tenant or view another Practice unless explicitly authorized.

## Support access

Platform support access requires an explicit `tenant_support_grant` containing tenant, reason, scope, approver, start, expiration and actor. Every action records both Platform actor and assumed tenant context in immutable audit. Break-glass access is separately alerted, time-limited and reviewed.

## Domain model

- `platform_account`: NorthStar operator identity.
- `tenant`: subscribing laboratory identity and lifecycle.
- `tenant_ownership`: owner contact, effective period, status and transfer history.
- `subscription`: tenant, plan, billing period, lifecycle state and paid-through dates.
- `license`: subscription-bound activation identity and status.
- `subscription_tier`: stable commercial tier definition.
- `entitlement`: stable capability code.
- `tier_entitlement`: tier capability, limits and effective version.
- `tenant_entitlement_override`: approved exception with reason and effective period.
- `tenant_feature_configuration`: tenant-controlled enablement where permitted.
- `license_activation`: environment, fingerprint, issue, expiration and revocation.
- `tenant_support_grant`: explicit temporary Platform access.
- `tenant_commercial_state_history`: append-only lifecycle evidence.

Commercial records are versioned and audited. Operational tenant records remain in tenant-owned ERP domains.

## Subscription lifecycle

```text
Trial → Active → Past Due → Grace Period → Suspended
                   └───────────────→ Cancelled → Archived
Suspended / Past Due / Cancelled ──approved resolution──→ Active
```

- Trial: limited effective period and tier-defined entitlements.
- Active: paid and fully eligible subject to configuration and authorization.
- Past Due: payment failure; policy may restrict selected capabilities.
- Grace Period: time-limited continuation with warnings and recovery path.
- Suspended: normal sessions, writes, portal access and new jobs blocked.
- Cancelled: service scheduled to end or ended according to paid-through policy.
- Archived: read-only retained state governed by retention/export policy.

No state deletes tenant data automatically.

## Entitlement evaluation

A feature is available only when all gates pass:

```text
Deployment configuration
AND Subscription entitlement
AND Tenant configuration
AND User permission
AND Domain prerequisites
```

Evaluation order:

1. confirm deployment/environment flag;
2. confirm tenant commercial state permits evaluation;
3. resolve subscription tier and effective entitlement version;
4. apply approved tenant override and usage limits;
5. confirm tenant has enabled/configured the capability;
6. confirm authenticated user authorization;
7. confirm required domain prerequisites;
8. return allow/deny reason and effective limits.

An entitlement never grants authorization. Feature code queries a server-side `EntitlementService` rather than subscription tables directly. Cached decisions use tenant/version-aware keys and support rapid revocation.

## Tenant suspension and reactivation

Suspension blocks normal interactive sessions, API writes, Doctor portal access and new background work while preserving data, audit, backups, legal holds and restricted recovery/export paths. Jobs stop safely or enter a tenant-suspended queue. Reactivation requires resolved commercial state, authorized actor, reason and immutable history.

## Security and scale

- platform roles use a separate membership and session audience;
- every control-plane action is audited;
- support grants are least-privilege and expire automatically;
- billing-provider webhooks require signatures, replay protection and idempotency;
- license secrets are hashed or encrypted;
- entitlements, caches, analytics and rate limits are tenant-scoped;
- one tenant’s suspension or licensing outage cannot affect another tenant;
- Platform analytics use minimized, aggregated data unless an explicit tenant grant permits detail.

## Deferred

Payment processor selection, metered billing, offline licensing, signed license bundles, subscription enforcement, tenant transfer runtime and licensing administration UI remain deferred.