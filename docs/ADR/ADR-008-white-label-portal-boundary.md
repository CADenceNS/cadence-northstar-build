# ADR-008 — White-Label Laboratory Platform as a Tenant Experience Boundary

## Status
Accepted for architecture; implementation deferred.

## Context

NorthStar is sold to dental laboratories. The subscribing laboratory is the tenant. Doctor Practices, Doctors and office users are customers or delegated users of that laboratory. The earlier phrase “White-Label Doctor Portal” incorrectly centered the Doctor as owner of the branded experience.

## Decision

NorthStar will provide a White-Label Laboratory Platform owned and configured by each laboratory tenant. The boundary owns tenant branding profiles, document and communication templates, portal identities, invitations, sessions, consent and custom-domain mappings. Existing tenant domains remain authoritative for Practices, Doctors, cases, prescriptions, production, communications, files, invoices, payments and tax records.

Branding, hostnames and portal presentation never grant authorization. Every portal request resolves the laboratory tenant, portal identity, Practice membership, role and entity relationship. Internal laboratory staff and external Doctor/office users use separate session audiences.

## Consequences

- Laboratories can present NorthStar as their branded operating platform.
- Practices and Doctors remain tenant customers, not tenants.
- Tenant Customization Studio owns laboratory-controlled presentation and configuration.
- Platform Owner controls remain separate and require support grants for tenant-data access.
- Custom domains select trusted tenant presentation context only after DNS and certificate verification.
- Portal messages use Clinical Communications rather than a separate chat store.
- Future patient access requires a separate policy and ADR.

## Rejected alternatives

- Treating each Doctor or Practice as a tenant: rejected because it conflicts with laboratory subscription ownership and operational data boundaries.
- Allowing branding or hostnames to determine access: rejected because presentation context is not authorization.
- Giving Platform Owners implicit tenant data access: rejected because it violates least privilege and commercial tenant isolation.