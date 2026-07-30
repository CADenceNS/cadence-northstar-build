# ADR-007 — Platform Commercial Control Plane

## Status
Accepted for architecture; implementation deferred.

## Decision
Platform ownership, tenant ownership, subscriptions, licenses, tier entitlements, and tenant commercial state form a dedicated control plane. Platform Owner authority does not automatically grant tenant data access. Tenant support access requires an explicit, expiring, auditable support grant.

## Consequences
Commercial entitlements and security authorization remain independent checks. Suspension preserves tenant data and restricted recovery access. Platform APIs, memberships, and audit categories require separate boundaries.