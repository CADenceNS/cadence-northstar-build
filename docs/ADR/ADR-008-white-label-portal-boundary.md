# ADR-008 — White-Label Portal as an Experience Boundary

## Status
Accepted for architecture; implementation deferred.

## Decision
The White-Label Doctor Portal will own portal identities, invitations, sessions, branding presentation, consent, and custom-domain mappings. Existing tenant domains remain authoritative for Practices, Doctors, cases, prescriptions, communications, files, and invoices.

## Consequences
Portal and internal staff authentication use separate session audiences. Branding never grants authorization. Custom domains select tenant presentation only after verified host binding. Portal messages use the existing Communications domain rather than a separate chat store.