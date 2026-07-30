# White-Label Doctor Portal Architecture

## Purpose

Define a secure tenant-branded external Doctor experience without duplicating NorthStar clinical records or allowing branding configuration to influence authorization.

## Boundary

The Portal is an experience and identity boundary over existing tenant application services. It owns portal accounts, invitations, sessions, branding presentation, domain mappings, and portal-specific consent. It does not own Practices, Doctors, patients, cases, prescriptions, invoices, communications, or files.

## Branding model

`tenant_branding_profile` includes:

- display name and legal name;
- approved logo ObjectStorage ID;
- primary, secondary, and accent tokens;
- typography tokens from an approved allowlist;
- email sender display name;
- support contacts;
- portal welcome copy;
- terms/privacy document versions;
- activation status and effective period.

All values are sanitized and rendered through fixed templates. Tenants cannot inject scripts, arbitrary HTML, CSS, or executable assets.

## Portal identity

Portal identity is separate from internal staff membership but linked to a Doctor and permitted Practices. Proposed records:

- `portal_identity`
- `portal_practice_membership`
- `portal_invitation`
- `portal_session`
- `portal_recovery_token`
- `portal_consent_acceptance`

A portal identity may belong to multiple authorized Practices within one tenant. Cross-tenant identities require separate memberships and tenant selection.

## Authentication

- opaque server-side sessions;
- HttpOnly, Secure, SameSite policy appropriate to custom-domain hosting;
- CSRF protection for browser mutations;
- email verification and invitation acceptance;
- rate limiting and account lockout;
- step-up authentication for sensitive exports or billing actions;
- future OIDC/passkey support behind stable identity ports.

Portal and staff cookies use different names, audiences, signing contexts, and session tables.

## Authorization

Every portal request resolves tenant, portal identity, Practice membership, Doctor ownership, and entity relationship. Portal permissions are allowlisted and narrower than internal Doctor-role permissions. Portal users cannot query arbitrary entity IDs or internal audit records.

## Custom domains

Future custom domains use:

1. tenant requests a hostname;
2. NorthStar issues DNS verification challenge;
3. ownership is verified;
4. certificate provisioning completes;
5. domain is activated with tenant binding;
6. host-header resolution selects the tenant branding profile.

Unknown or ambiguous hosts fail closed. Custom domains never determine authorization by themselves.

## Communications

Portal messages append to the existing Communications operational-history domain through authorized application commands. Portal message events identify the external actor and channel. The Portal does not introduce an independent chat database.

## Files

Uploads use ObjectStorage, malware/quarantine controls when available, explicit kinds and size limits, and entity authorization. Public APIs return safe metadata only. Downloads use authorized endpoints or short-lived URLs.

## Security and privacy

- tenant branding assets are scanned and content-type verified;
- privacy and terms acceptance are versioned;
- PHI/PII visibility follows minimum necessary access;
- portal activity produces immutable security audit;
- operational events append to Communications without copying credentials or secrets;
- account enumeration is prevented in login and recovery responses;
- custom-domain cookies cannot leak across tenants.

## Deferred

- portal React implementation;
- invitation and recovery delivery;
- custom-domain provider;
- MFA/passkeys;
- Doctor self-service billing and case submission policies;
- patient portal.