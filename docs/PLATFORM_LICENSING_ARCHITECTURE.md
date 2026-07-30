# Platform Owner, Tenant Ownership & Licensing Architecture

## Purpose

Define NorthStar’s commercial control plane without weakening tenant isolation or turning subscription state into operational data ownership.

## Roles and trust boundaries

### Platform Owner

A Platform Owner administers the NorthStar service itself. This role may manage tenant lifecycle, subscriptions, licenses, entitlements, platform configuration, and support access. It is not automatically a tenant administrator.

### Tenant Owner

A Tenant Owner controls the tenant’s commercial relationship, designated administrators, billing contact, branding authority, and data-export authority.

### Tenant Administrator

A Tenant Administrator manages users and tenant operations within granted permissions. It cannot alter platform contracts or impersonate Platform Owners.

## Support access

Platform support access to tenant data requires an explicit support grant containing tenant, reason, scope, approver, start time, expiration, and actor. Every action taken under the grant includes both the Platform actor and assumed tenant context in immutable audit. Break-glass access is time-limited, separately alerted, and reviewed.

## Domain model

- `platform_account`: legal platform operator identity.
- `tenant_ownership`: tenant, owner user/contact, effective period, status, transfer history.
- `subscription`: tenant, plan, billing period, lifecycle status, start/end dates.
- `license`: subscription, license key/token identity, activation state, device or deployment scope where applicable.
- `subscription_tier`: stable commercial tier definition.
- `entitlement`: stable feature capability code.
- `tier_entitlement`: tier-to-entitlement assignment with limits.
- `tenant_entitlement_override`: approved exception with effective period and reason.
- `license_activation`: activation fingerprint, environment, issued/revoked timestamps.
- `tenant_commercial_state`: active, grace-period, suspended, terminated, archived.

Commercial records are versioned and audited. Operational tenant records remain in tenant-owned domains.

## Subscription lifecycle

```text
Trial → Active → Past Due → Grace Period → Suspended → Reactivated
                                            └→ Terminated → Archived
```

Cancellation may remain active through a paid-through date. Suspension is reversible; termination requires explicit data-retention and export handling.

## License enforcement

License evaluation uses a server-side `EntitlementService`:

```ts
interface EntitlementService {
  evaluate(context: {
    tenantId: string;
    environment: string;
    entitlement: string;
    role?: string;
    at?: string;
  }): Promise<{ allowed: boolean; reason: string; limits?: Record<string, number> }>;
}
```

Feature code queries entitlements through this service rather than reading subscription tables. Evaluation may be cached briefly but must support revocation. Security permissions and commercial entitlements are independent checks; an entitlement never grants authorization.

## Tenant suspension

Suspension blocks normal interactive sessions, API writes, external portal access, and new background work. It preserves data, audit, backups, legal holds, and restricted Platform/Tenant Owner recovery functions. Critical outbound jobs should stop safely or enter a suspended queue. Reactivation records actor, reason, commercial resolution, and timestamp.

## Activation and deactivation

License activations are idempotent and environment-bound. Production activation tokens are not valid in Development or UAT. Deactivation revokes future sessions or capabilities according to policy without deleting tenant data.

## Feature flags and subscription tiers

Feature flags control deployment and operational rollout. Entitlements control commercial availability. A capability is usable only when:

1. the deployment feature flag permits it;
2. the tenant subscription entitlement permits it;
3. the authenticated user is authorized;
4. required domain prerequisites are satisfied.

## Security

- Platform roles reside in a dedicated platform membership boundary.
- Platform APIs use separate permissions and audit categories.
- Tenant support grants are time-bound and least-privilege.
- Subscription webhooks require signature validation, replay protection, and idempotency.
- License secrets are hashed or encrypted; raw activation secrets are not persisted when avoidable.
- Suspension and reactivation require dual authorization for high-risk tenants when configured.

## Deferred

- payment processor selection;
- metered billing;
- offline licensing;
- signed license bundles;
- tenant transfer UI;
- production subscription enforcement.