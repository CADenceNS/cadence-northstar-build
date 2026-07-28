# Digital Intake Platform

## Purpose

The Digital Intake Platform is NorthStar’s durable, tenant-aware entry boundary for automatic digital submissions, manual digital entry, and physical case entry. Every supported intake method creates the same submission record and follows the same prescription, validation, routing, product-resolution, acceptance, and Billing Review lifecycle.

It is not scanner-specific. Scanner and portal integrations remain adapters into the stable intake contract.

## Verified architecture

```text
Scanner / portal / secure upload / email / mail / courier / walk-in
                              |
                              v
                      Intake Submission
                              |
                              v
                 Mandatory Digital Prescription
                              |
                 +------------+------------+
                 |                         |
                 v                         v
          Clinical Validation      PostgreSQL ObjectStorage
                 |
                 v
           Routing Resolution
                 |
                 v
      Price-free Product Resolution
                 |
                 v
       Operational Case Creation
                 |
                 v
 Production -> QC -> Billing Review -> Billing-owned pricing/invoice
```

## Durable records

Migrations 0005 and 0006 provide:

- Scanner Providers
- Doctor Preference Profiles
- Practice routing profiles
- tenant routing defaults
- Product Catalog
- Pricing Schedules and schedule items
- intake submissions
- versioned Digital Prescriptions
- intake attachments
- validation decisions
- routing resolutions
- product resolutions
- Billing Reviews
- immutable intake history

All operational records are tenant owned.

## Intake methods

### Automatic digital submission

Represents a registered scanner, portal, secure-upload, or future API adapter. Provider metadata distinguishes official adapters, generic-file providers, manual-upload providers, simulators, and future SDKs. `production_ready` prevents a simulator from being represented as a verified production integration.

### Manual digital entry

Used for emailed STL files, portal exports, secure uploads, and external-storage downloads entered by laboratory staff.

### Physical case entry

Used for physical impressions, models, bite registrations, printed prescriptions, shade tabs, and implant components. Physical cases still require the in-system Digital Prescription.

## Lifecycle enforcement

A submission cannot create an operational case until it has:

1. a completed Digital Prescription;
2. a latest validation result of `complete`;
3. a routing resolution;
4. at least one Product Resolution record;
5. an existing patient association.

Acceptance creates the operational case and a pending Billing Review. Billing Review approval freezes the product identities. Sprint 12 does not calculate customer pricing or generate a new intake-driven invoice.

## Routing

Verified precedence is:

1. authorized case override;
2. restoration-level prescription override;
3. active Doctor Preference Profile;
4. active Practice routing profile;
5. tenant routing default;
6. manual review.

Routing is independent of Scanner Provider source.

## Product and pricing boundaries

Product Resolution uses the price-free Product Catalog foundation. Product Catalog owns SKU and operational classification; it contains no customer-pricing columns after migration 0006.

Pricing Schedules are separate records supporting future standard, contract, promotion, and customer-override policy. Billing owns future pricing calculations, tax application, invoice generation, payments, and statements.

See ADR-002 and `PRODUCT_RESOLUTION.md`.

## Attachments

All Digital Intake bytes use the existing production ObjectStorage abstraction and durable `object_records`. Verified kinds include:

- STL, OBJ, and PLY
- CBCT and DICOM
- X-rays
- clinical and shade photographs
- ZIP intake packages
- generated prescription PDFs

No in-memory ObjectStorage is present in the Digital Intake production composition or production-aligned integration suite.

## Administration

Administrator-only workspaces and APIs manage:

- versioned Doctor clinical, material, production, routing, and outsource preferences;
- Practice routing profiles;
- tenant routing defaults;
- Pricing Schedule configuration records.

Authorization, tenant isolation, validation, audit events, and browser workflows are verified.

## Communications, notifications, and audit

Intake lifecycle transitions append operational system events to Clinical Communications and generate internal notifications. Authenticated changes append separate immutable audit events. `intake_history` is an immutable operational record protected by a PostgreSQL trigger.

## Compatibility

Legacy Case Intake remains supported and is not automatically redirected. ADR-001 defines the future migration strategy: preserve its public contract while eventually translating the command internally into a Digital Intake submission after explicit compatibility approval.

## ADRs

- ADR-001 — Legacy Case Intake compatibility
- ADR-002 — Product Catalog and Pricing Schedule separation
- ADR-003 — Scanner Provider adapter architecture
- ADR-004 — Event-driven Billing Review handoff

## Verified evidence

Sprint 12 Validation run `30407654085` and Runtime Validation run `30407654184` passed on implementation head `d08490f545b3abb34af98b5845ec157d3c898b6e`.

## Deferred

- production scanner-vendor adapters, credentials, portal SDKs, and webhooks;
- malware scanning, quarantine, archive inspection, retention, and legal holds;
- DICOM/CBCT clinical processing;
- Pricing Schedule calculations and eligibility;
- post-QC Billing command and transactional outbox;
- invoice generation, shipment document bundling, and statement inclusion from frozen intake products;
- controlled migration of legacy Case Intake behind the Digital Intake command.
