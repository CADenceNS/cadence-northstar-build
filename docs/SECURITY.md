# CADence NorthStar Security Architecture

## Purpose

This document defines the production identity, session, credential, request-security, audit, and future federation architecture introduced in Sprint 10. It is subordinate to `docs/ENGINEERING_CONSTITUTION.md` and applies to every authenticated NorthStar workflow.

## Security boundary

The secure API gateway is the authoritative request boundary. Domain handlers do not authenticate users independently. The gateway performs the following sequence:

1. Parse the opaque session cookie.
2. Hash the presented token and resolve the server-side PostgreSQL session.
3. Reject revoked, idle-expired, absolute-expired, inactive-user, or unknown sessions.
4. Resolve the tenant membership, role, locations, practice grants, and administrative-override flag captured in the session.
5. Validate CSRF protection for state-changing browser requests.
6. Evaluate the server-side permission matrix and ownership scope.
7. Attach a trusted request identity and audit context.
8. Dispatch to the existing ERP domain handler.

The browser, request body, query parameters, and forwarded actor headers are not identity authorities.

## Credential storage

Passwords are stored only as salted, computationally expensive hashes. Sprint 10 uses Node.js `scrypt` with independent random 128-bit salts, a work factor of N=32768, r=8, p=1, and a 64-byte derived key. Verification uses constant-time comparison.

Production startup requires `NORTHSTAR_BOOTSTRAP_PASSWORD` when the initial system administrator credential has not yet been provisioned. Plaintext passwords are never stored in PostgreSQL, logs, audit metadata, browser storage, or API responses.

A future credential migration may adopt Argon2id through a reviewed native or managed identity provider. The encoded hash format includes its algorithm and parameters so rehash-on-login can be added without breaking existing credentials.

## Session management

Sessions are opaque, random 256-bit bearer tokens. PostgreSQL stores only SHA-256 token hashes. The browser receives the raw token in an HttpOnly cookie with:

- `Path=/`
- `HttpOnly`
- `SameSite=Strict`
- `Secure` in production
- an explicit maximum age

Controls:

- 30-minute idle timeout
- 12-hour absolute timeout
- sliding idle renewal bounded by the absolute timeout
- logout revocation
- server-side inactive-user enforcement
- five concurrent sessions per user; older active sessions are revoked
- device metadata through user agent and source IP
- session identifiers and rotation lineage fields
- no user identity stored as browser-local authentication proof

The application restores the current user through `GET /api/auth/session`. Browser session storage contains only the per-session CSRF token, not the authentication token.

## CSRF protection

State-changing requests require both:

- a valid SameSite server session cookie, and
- the session-bound `X-CSRF-Token` value returned during login/session restoration.

The gateway also rejects cross-origin mutation requests whose `Origin` does not match the request host. Logout revokes the session and clears the cookie.

## Account lockout

Five consecutive invalid password attempts lock the account for 15 minutes. Successful authentication clears the failed-attempt counter. Lockout events and failed login attempts are audited. Future risk-based authentication may add exponential delays, breached-password screening, impossible-travel detection, and administrative unlock workflows.

## Password reset architecture

`identity_tokens` provides single-purpose, hashed, expiring, one-time token records for password reset. Production delivery is intentionally deferred until a verified email provider and user-management interface exist.

The permanent flow is:

1. Accept a reset request without revealing whether an account exists.
2. Generate a high-entropy token and store only its hash.
3. Deliver the raw token through a verified channel.
4. Validate purpose, tenant, expiry, and unused state.
5. replace the password hash in one transaction.
6. consume the token and revoke all active sessions.
7. append immutable security audit events.

## Email verification architecture

Email verification uses the same one-time token system with the `email-verification` purpose. Verified state is stored on the credential record. Verification will become mandatory before externally provisioned Doctor and portal accounts can authenticate.

## Future SSO and OIDC compatibility

The identity layer separates users, memberships, credentials, and sessions. A future OIDC provider can authenticate an external subject, map it to a NorthStar user and tenant membership, and issue the same NorthStar server session. Domain authorization will remain unchanged.

Provider links must be tenant-aware and uniquely bind issuer plus subject. Just-in-time provisioning, domain discovery, SCIM, and enterprise claims mapping require separate reviewed work.

## Future MFA compatibility

`identity_tokens` reserves an `mfa-enrollment` purpose. Future MFA should support WebAuthn/passkeys first, with TOTP as a controlled fallback. Recovery codes must be individually hashed. Sensitive roles may require phishing-resistant MFA and step-up authentication.

## Tenant and location isolation

Every session is bound to one tenant. Repository operations continue using tenant-scoped contexts. Sessions also contain allowed location and practice identifiers. Administrative override is explicit and limited to administrator memberships.

Practice-scoped requests are denied when a non-override user attempts to operate outside their granted practice list. Future location-specific domain records must carry a location identifier and be filtered by the same centralized evaluator.

## Request identity and audit context

Authenticated request identity contains:

- user ID and display name
- email
- normalized role
- tenant ID
- location grants
- practice grants
- administrative-override status
- server session ID

Authentication success/failure, logout, CSRF failure, permission denial, scope denial, and authenticated mutations append immutable audit events with operation, result, role, tenant, IP, user agent, timestamp, and session context.

## Error handling

Security responses use stable status classes:

- `401` unauthenticated, expired, revoked, or invalid session
- `403` authenticated but denied, including CSRF or scope failures
- `423` temporary account lockout

Responses do not disclose whether an email address, credential, tenant membership, or external identity exists.

## Operational requirements

Production deployments must provide HTTPS, trusted proxy configuration, secret management, database encryption, backups, time synchronization, centralized logs, alerting, rate limiting, and incident procedures. Session and token cleanup jobs must remove expired records according to retention policy without modifying immutable audit history.

## Deferred

- production email delivery for reset and verification
- OIDC/SSO provider integration
- WebAuthn, passkeys, TOTP, and recovery codes
- administrative user and membership management UI
- risk-based authentication and anomaly detection
- distributed rate limiting
- managed secret rotation
