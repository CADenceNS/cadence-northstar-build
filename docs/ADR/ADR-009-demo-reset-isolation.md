# ADR-009 — Demo Reset Is Environment-Isolated

## Status
Accepted for architecture; implementation deferred.

## Decision
Seed and reset capabilities will exist only in Development and UAT. Production will not register reset routes, commands, or workers. Seed packs are deterministic, synthetic, versioned, and idempotent. Reset commands require environment allowlisting, administrator authorization, confirmation, scoped tenant identity, idempotency, and immutable audit.

## Consequences
Environment identity must be server-owned. Demo data cannot contain production records or reused production credentials. Failed resets leave the sandbox locked for review rather than partially available.