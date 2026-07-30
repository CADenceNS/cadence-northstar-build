# Community Preview 2 Baseline Manifest

## Release identity

- Product: CADence NorthStar
- Version: v0.2.0
- Release name: Community Preview 2
- Release tag: v0.2.0-cp2
- Release channel: Community Preview
- Migration version: 0006
- Certification date: 2026-07-29

The certified commit hash and final workflow run identifiers are recorded in the GitHub release and final certification report after the release branch, `main`, and tag are aligned.

## Platform capabilities

### Authentication

- Server-managed opaque sessions
- HttpOnly and SameSite cookie controls
- CSRF protection and token rotation
- Account lockout and session expiration

### Authorization

- Tenant, role, Practice, Doctor ownership, and applicable location scope
- Read/write distinction
- Explicit administrative override
- Centralized Communications entity authorization

### Communications

- Immutable operational communication history
- Entity-bound timelines and threads
- Versioned corrections
- Safe ObjectStorage attachment metadata
- Notification foundation
- Authorization-filtered search
- Separate immutable security audit evidence

### Digital Intake

- Automatic-provider foundation
- Manual digital entry
- Physical case entry
- Shared intake lifecycle
- Mandatory Smart Digital Prescription
- Restoration-aware validation
- Production routing resolution
- Billing Review foundation

### Smart Digital Prescription

- Dynamic restoration fields
- Multiple restorations and arches
- Fixed, implant, removable, appliance, orthodontic, and diagnostic foundations
- Structured clinical details, notes, and attachments
- Doctor, laboratory, production, and outsourcing PDF copies

### Product Resolution

- Catalog-backed SKU identification
- Category, type, subtype, material, department, accounting category, and quantity mapping
- No customer-pricing exposure during intake
- Frozen product set after Billing Review approval

### Routing foundation

Routing precedence:

1. Case override
2. Prescription restoration override
3. Doctor Preference Profile
4. Practice routing profile
5. Tenant routing default
6. Manual review

### Administration

- Doctor Preference administration
- Practice routing administration
- Tenant routing administration
- Pricing Schedule configuration foundation

### Pricing Schedule foundation

- Product Catalog is price-free for customer pricing
- Pricing Schedules are separate durable configuration
- Billing remains responsible for pricing calculations and invoices

### Security and audit

- PostgreSQL-backed identity and session state
- Immutable audit events
- Tenant isolation
- Parameterized persistence
- ObjectStorage abstraction with durable object records
- Migration rollback and reapplication contracts

### ADR governance

Accepted ADRs cover:

- Legacy Case Intake compatibility
- Product Catalog and Pricing Schedule separation
- Scanner Provider adapter architecture
- Event-driven Billing Review strategy
- Communications as the operational-history domain

## Validation evidence

Certification requires successful evidence for:

- Frozen dependency installation
- Strict TypeScript
- Shared, API, and React production builds
- PostgreSQL migrations 0001–0006
- Migration rollback and reapplication
- Repository integrations
- Security integrations
- Communications integrations
- Digital Intake and administration integrations
- Runtime Validation
- Complete Playwright regression

Final run identifiers and the certified commit are recorded after the exact final documentation head passes validation.

## Deferred work

- Production scanner-vendor adapters and external portal SDKs
- Managed cloud ObjectStorage
- Malware scanning, quarantine, retention, and legal holds
- Authorized attachment download endpoints and short-lived URLs
- DICOM and CBCT clinical processing
- Pricing Schedule calculation and eligibility rules
- Post-QC Billing command and transactional outbox
- Intake-driven invoice generation and document bundling
- Automated statement inclusion
- Legacy Case Intake migration behind a Digital Intake application command
- SSO, SCIM, MFA, passkeys, distributed rate limiting, and managed secret rotation

Deferred work is not represented as complete in Community Preview 2.
