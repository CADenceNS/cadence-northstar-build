# Sprint 10 — Production Identity & Security

## Status

In progress. Implementation is present on the Sprint 10 feature branch, but the sprint must remain incomplete until all CI, Runtime Validation, security integration, and Playwright gates pass on the final head.

## Objective

Replace development authentication with centralized production identity, server-side sessions, server-enforced authorization, tenant/location/practice scope evaluation, and immutable security audit context without changing verified ERP workflows.

## Implemented

- PostgreSQL identity credential, membership, session, and one-time-token schema.
- Salted `scrypt` password hashing with encoded parameters and constant-time verification.
- Server-side opaque sessions storing only token hashes.
- HttpOnly, SameSite=Strict cookies with production Secure policy.
- Idle and absolute expiration, sliding renewal, logout revocation, device metadata, and concurrent-session limits.
- Five-attempt temporary account lockout.
- Session-bound CSRF tokens and same-origin mutation checks.
- Centralized request identity, permission evaluation, practice scope evaluation, and security error handling.
- Role matrix for administrator, laboratory, office, operational, clinical, financial, Doctor, and auditor roles.
- React session restoration from the server and automatic CSRF headers for mutations.
- Immutable authentication, logout, CSRF, authorization-denial, scope-denial, and authenticated-mutation audit events.
- Password reset, email verification, OIDC/SSO, and MFA-compatible durable token architecture.
- Security integration tests and a dedicated Sprint 10 validation workflow.
- `docs/SECURITY.md` and `docs/AUTHORIZATION.md`.

## Acceptance gates

- [ ] Frozen-lockfile installation passes.
- [ ] Strict TypeScript passes.
- [ ] Production build passes.
- [ ] Migration 0003 applies, rolls back, and reapplies.
- [ ] Authentication integration tests pass.
- [ ] Permission matrix and authorization tests pass.
- [ ] Session lifecycle, revocation, lockout, and CSRF tests pass.
- [ ] Tenant and practice isolation tests pass.
- [ ] Runtime Validation passes with PostgreSQL identity storage.
- [ ] Existing Playwright regressions pass.
- [ ] Security-focused browser scenarios pass.
- [ ] Final documentation accurately distinguishes implemented, verified, and deferred work.

## Deferred

- Production email delivery for password reset and email verification.
- User, membership, role, and session administration UI.
- OIDC/SSO provider integration and SCIM.
- WebAuthn/passkeys, TOTP, recovery codes, and step-up authentication.
- Distributed rate limiting and risk-based anomaly detection.
- Managed secrets and automated credential rotation.

## Completion rule

Do not mark Sprint 10 complete or move the pull request out of draft until every acceptance gate passes on the final head.
