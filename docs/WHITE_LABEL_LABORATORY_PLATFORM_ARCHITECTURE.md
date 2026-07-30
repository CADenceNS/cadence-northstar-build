# White-Label Laboratory Platform Architecture

## Purpose

Define how each subscribing dental laboratory operates NorthStar as its own branded laboratory management platform while NorthStar retains centralized platform governance. The laboratory is the tenant and commercial customer. Practices and Doctors are customers and delegated users of that laboratory.

## Boundary

The White-Label Laboratory Platform is a tenant experience boundary over NorthStar application services. It owns tenant branding configuration, portal presentation, portal identities, invitations, sessions, domain mappings, tenant communication templates and portal consent. It does not own Practices, Doctors, cases, prescriptions, invoices, payments, communications, files or authorization policy.

## Tenant branding model

A versioned `tenant_branding_profile` should support:

### Business identity

- company and legal names;
- address, phone, website and email;
- customer-service, billing and technical-support contacts;
- approved logo and favicon ObjectStorage IDs.

### Visual branding

- primary, secondary and accent color tokens;
- approved typography tokens;
- dashboard theme and light/dark preference;
- login-screen branding;
- portal welcome page and support content;
- activation and effective periods.

### Document branding

- invoice, statement and receipt templates;
- packing slips and shipping labels;
- prescription forms;
- laboratory and operational reports;
- version, approval and effective dates for every template.

### Communication branding

- email, SMS and in-application notification templates;
- sender display name and reply-to configuration;
- locale and approved merge fields;
- tenant support contacts and unsubscribe/compliance content.

All branding is sanitized and rendered through fixed templates. No arbitrary JavaScript, executable HTML or unrestricted CSS is allowed. Branding never influences authentication, authorization, tenant resolution or Practice access.

## Website integration

Laboratories may connect their existing websites through:

- a standard login button;
- a tenant portal link;
- signed return URLs and secure redirection;
- future embedded launch components that do not embed authenticated clinical pages in unsafe cross-origin frames.

Supported future address patterns:

```text
laboratory.northstarerp.com
portal.laboratory.com
```

Custom-domain lifecycle:

1. tenant requests hostname;
2. NorthStar issues DNS verification challenge;
3. domain ownership is verified;
4. certificate is provisioned and renewed;
5. hostname is bound to exactly one tenant;
6. trusted host resolution selects branding and authentication audience;
7. unknown, expired or ambiguous bindings fail closed.

A hostname selects tenant presentation context only. Authorization still requires an authenticated portal identity and an active tenant/Practice membership.

## Portal identity hierarchy

```text
Laboratory tenant
└─ Practice customer account
   ├─ Doctor portal identity
   └─ Office staff portal identity
```

Portal identities are separate from laboratory staff identities and sessions. A portal identity may have authorized memberships in multiple Practices within one tenant. Cross-tenant access requires separate tenant memberships and explicit tenant selection; no identity receives cross-tenant access by default.

Proposed records:

- `portal_identity`;
- `portal_practice_membership`;
- `portal_role_assignment`;
- `portal_invitation`;
- `portal_session`;
- `portal_recovery_token`;
- `portal_consent_acceptance`;
- `tenant_domain_binding`;
- `tenant_branding_profile` and template versions.

## Doctor and office-user experience

Authorized portal users may be permitted to:

- submit cases and complete Smart Digital Prescriptions;
- upload STL, OBJ, CBCT, DICOM, radiographs, photographs and approved documents;
- view case and production status;
- review laboratory updates and communicate through Communications;
- receive notifications;
- view invoices and statements;
- make payments and download receipts when Billing enables those commands;
- request pickups and supplies;
- review account history;
- invite or manage office users according to Practice policy;
- update password, profile and notification preferences.

Every request resolves tenant, portal identity, Practice membership, role, entity ownership and requested action. Portal users cannot enumerate arbitrary entity IDs, view another Practice, access internal cost, security audit, laboratory-only production notes or Platform Owner controls.

## Laboratory staff experience

Tenant staff use internal workspaces, not the Doctor portal. Dashboards are role-scoped:

- Customer Service;
- Production;
- CAD;
- Ceramics;
- QC;
- Shipping;
- Accounting;
- Sales;
- Management;
- Tenant Owner;
- Tenant Administrator.

Each dashboard is a projection over authorized domain services. Hiding a navigation item is not authorization; APIs and commands enforce the same policy.

## Tenant Customization Studio

The tenant-owned control center includes:

- Business Profile;
- Branding;
- Financial and Tax Settings;
- Payment Methods and Invoice Numbering;
- Turnaround Times;
- Shipping and Pickup Scheduling;
- Materials, Product Catalog and Pricing Schedules;
- Clinical Preferences;
- Scanner Integrations;
- Notification Templates;
- Security Policies;
- Portal Settings and Doctor Registration Policies;
- Support Contacts;
- Document Templates.

The Studio is tenant-scoped and isolated from Platform Owner controls. Configuration changes are versioned, validated, approved where required and auditable.

## Authentication and security

- opaque server-side portal sessions with distinct cookie names and audience;
- Secure, HttpOnly and appropriate SameSite policies per hosting model;
- CSRF protection, origin validation, rate limiting and account lockout;
- invitation acceptance and email verification;
- step-up authentication for payments, exports and office-user administration;
- future OIDC and passkeys behind stable identity ports;
- account-enumeration resistance;
- safe ObjectStorage uploads, quarantine and authorized downloads;
- immutable portal security audit and operational Communications events;
- no cookie sharing across tenants or custom domains.

## Commercial scalability

- branding and domain configurations are cached by tenant/version with tenant-safe keys;
- assets are stored once and served through authorized or public-safe delivery paths;
- template rendering is asynchronous where appropriate and records template version;
- domain provisioning and certificate renewal are adapter-driven;
- portal traffic is independently rate-limited and observable per tenant;
- tenant-specific outages or invalid configurations fail without affecting other laboratories.

## Deferred

Portal runtime, branding UI, invitations, authentication, payment commands, custom-domain provider, certificate automation, MFA/passkeys and patient portal remain deferred.