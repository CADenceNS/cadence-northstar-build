# Authenticated Tenant Context Boundary

## CF-1A0 root cause

The secure gateway already derived `identity.tenantId` from a server-side authenticated session, but the separately started operational runtime closed over one process-wide default `RepositoryContext`. The gateway forwarded mutable tenant/actor headers, while the runtime did not make those headers authoritative. That left authenticated non-default tenant traffic blocked at the gateway instead of safely executing under its own tenant scope.

## Boundary

The gateway now issues a short-lived HMAC-SHA-256 internal assertion only after session authentication. It contains the authenticated actor, laboratory role, tenant, audience, and expiry. The operational runtime verifies that assertion and binds its repository context with `AsyncLocalStorage`; repositories receive that trusted context rather than an ID from the request payload, query, route, or browser header.

- `X-Northstar-Internal-Context` supplied by a client is rejected at the gateway.
- Raw `X-Northstar-Tenant`, actor, and role headers are stripped before the internal hop.
- Missing, forged, expired, or malformed assertions fail closed.
- A CADence Platform Admin cannot mint tenant operational context; commercial/control-plane access is separate from operational data access.
- The legacy default tenant remains only for deterministic bootstrap/migration and trusted in-process compatibility jobs, never as fallback for an authenticated operational request.

Production deployments must configure `NORTHSTAR_INTERNAL_CONTEXT_SECRET` (at least 32 characters). Development/test uses a process-local ephemeral secret so independently started runtimes fail closed instead of accepting unconfigured assertions.
