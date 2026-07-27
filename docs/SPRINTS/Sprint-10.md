# Sprint 10 — Production Identity & Security

## Status

In progress. Production identity and browser integration are implemented. Sprint 10 remains incomplete until Sprint 10 Validation, Runtime Validation, and the complete Playwright suite pass on the final documentation head.

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

- Origin validation now accepts the configured public origin or the proxy-preserved `X-Forwarded-Host`/request host. It does not disable origin validation.
- Session restoration rotates a fresh cryptographically random CSRF token, stores only its hash, and returns the new token to the authenticated browser.
- Playwright now verifies the real HttpOnly, SameSite=Strict cookie, confirms `localStorage` is not authentication authority, reloads through `/api/auth/session`, and verifies logout invalidation.
- CRUD regressions wait for and assert the protected API response status so CSRF or authorization failures cannot be hidden by a UI timeout.
- Existing coverage was strengthened rather than weakened.

## Browser integration notes

- Login establishes the opaque HttpOnly server session and returns the initial CSRF token.
- Refresh restores identity from `/api/auth/session` and rotates CSRF state.
- The shared fetch integration adds CSRF only to same-origin mutations.
- Protected navigation remains inaccessible without a valid server session.
- Logout revokes the durable session and expires the cookie.
- Session expiration clears browser CSRF state and returns the application to the existing login screen.

## Acceptance gates

- [ ] Frozen-lockfile installation passes on final head.
- [ ] Strict TypeScript passes on final head.
- [ ] Production build passes on final head.
- [ ] Migration 0003 applies, rolls back, and reapplies.
- [ ] Authentication integration tests pass.
- [ ] Permission matrix and authorization tests pass.
- [ ] Session lifecycle, revocation, lockout, and CSRF tests pass.
- [ ] Tenant and practice isolation tests pass.
- [ ] Runtime Validation passes with PostgreSQL identity storage.
- [ ] Existing Playwright regressions pass.
- [ ] Security-focused browser scenarios pass.
- [x] Root cause and browser testing assumptions are documented.
- [ ] Final documentation accurately distinguishes implemented, verified, and deferred work.

## Deferred

- Production email delivery for password reset and email verification.
- User, membership, role, and session administration UI.
- OIDC/SSO provider integration and SCIM.
- WebAuthn/passkeys, TOTP, recovery codes, and step-up authentication.
- Distributed rate limiting and risk-based anomaly detection.
- Managed secrets and automated credential rotation.

## Completion rule

Do not mark Sprint 10 complete or move the pull request out of draft until every acceptance gate passes on the final head. No security control may be weakened to satisfy browser tests.
