# Sprint 10 — Production Identity & Security

## Status

Complete. Production identity, server-side authorization, and browser authentication integration are implemented and verified without weakening security controls or changing established ERP workflows.

## Objective

Replace development authentication with centralized production identity, server-side sessions, server-enforced authorization, tenant/location/practice scope evaluation, and immutable security audit context without changing verified ERP workflows.

## Implemented

- PostgreSQL identity credential, membership, session, and one-time-token schema.
- Salted `scrypt` password hashing with encoded parameters and constant-time verification.
- Server-side opaque sessions storing only token hashes.
- HttpOnly, SameSite=Strict cookies with production Secure policy.
- Idle and absolute expiration, sliding renewal, logout revocation, device metadata, and concurrent-session limits.
- Five-attempt temporary account lockout.
- Session-bound CSRF tokens and proxy-aware same-origin mutation checks.
- CSRF-token rotation during authenticated session restoration.
- Centralized request identity, permission evaluation, practice scope evaluation, and security error handling.
- Role matrix for administrator, laboratory, office, operational, clinical, financial, Doctor, and auditor roles.
- React session restoration from the server and automatic CSRF headers for mutations.
- Browser authentication authority removed from `localStorage`; the server session cookie is authoritative.
- Immutable authentication, logout, CSRF, authorization-denial, scope-denial, and authenticated-mutation audit events.
- Password reset, email verification, OIDC/SSO, and MFA-compatible durable token architecture.
- Security integration tests and a dedicated Sprint 10 validation workflow.
- `docs/SECURITY.md` and `docs/AUTHORIZATION.md`.

## Sprint 10A root cause

The initial Playwright regression had three related causes:

1. The authentication regression still asserted that `northstar.session` existed in `localStorage`, even though Sprint 10 intentionally removed browser-managed authentication.
2. CSRF same-origin validation compared the browser's public Vite origin with the internal gateway `Host` value. Behind the development reverse proxy these hosts can differ, so valid browser mutations were rejected with HTTP 403.
3. `/api/auth/session` attempted to return the CSRF value attached to the incoming GET request. Because only a CSRF hash is persisted and GET restoration does not send a CSRF header, a refreshed browser received an empty token and could not perform its next protected mutation.

## Sprint 10A resolution

- Origin validation accepts the configured public origin or the proxy-preserved `X-Forwarded-Host`/request host. Origin validation remains enforced.
- The Vite proxy preserves the browser-facing host and protocol through standard forwarded headers.
- Session restoration rotates a fresh cryptographically random CSRF token, stores only its hash, and returns the new token to the authenticated browser.
- Security integration tests prove that the previous CSRF token is rejected after rotation and the current token succeeds.
- Playwright verifies the real HttpOnly, SameSite=Strict cookie, confirms `localStorage` is not authentication authority, reloads through `/api/auth/session`, and verifies logout invalidation.
- CRUD regressions wait for and assert protected API response status so CSRF or authorization failures cannot be hidden by a UI timeout.
- Existing coverage was strengthened rather than weakened.

## Browser integration notes

- Login establishes the opaque HttpOnly server session and returns the initial CSRF token.
- Refresh restores identity from `/api/auth/session` and rotates CSRF state.
- The shared fetch integration adds CSRF only to same-origin mutations.
- Protected navigation remains inaccessible without a valid server session.
- Logout revokes the durable session and expires the cookie.
- Session expiration clears browser CSRF state and returns the application to the existing login screen.

## Verified

Sprint 10 Validation run `30301080425` passed:

- Frozen dependency installation.
- Strict TypeScript validation and production builds.
- PostgreSQL identity migration application.
- Existing persistence contracts.
- Authentication, authorization, permission, lockout, session, CSRF rotation, and immutable-audit integration tests.
- Identity migration rollback and reapplication.
- Secure API and web startup.
- Secure session API lifecycle.
- Complete Playwright regression suite.

Runtime Validation run `30301080443` passed:

- Reproducible installation.
- Strict TypeScript and production builds.
- Durable persistence and identity migrations.
- Secure API health and frontend startup.
- Browser login, server-session restoration, protected navigation, CSRF-protected mutations, logout invalidation, and all established ERP browser workflows.

## Acceptance gates

- [x] Frozen-lockfile installation passes on final implementation head.
- [x] Strict TypeScript passes.
- [x] Production build passes.
- [x] Migration 0003 applies, rolls back, and reapplies.
- [x] Authentication integration tests pass.
- [x] Permission matrix and authorization tests pass.
- [x] Session lifecycle, revocation, lockout, CSRF validation, and CSRF rotation tests pass.
- [x] Tenant and practice isolation tests pass.
- [x] Runtime Validation passes with PostgreSQL identity storage.
- [x] Existing Playwright regressions pass.
- [x] Security-focused browser scenarios pass.
- [x] Root cause and browser testing assumptions are documented.
- [x] Final documentation accurately distinguishes implemented, verified, and deferred work.

## Deferred

- Production email delivery for password reset and email verification.
- User, membership, role, and session administration UI.
- OIDC/SSO provider integration and SCIM.
- WebAuthn/passkeys, TOTP, recovery codes, and step-up authentication.
- Distributed rate limiting and risk-based anomaly detection.
- Managed secrets and automated credential rotation.

## Remaining blockers

None for the Sprint 10 definition of done.
