# Digital Intake Platform

## Purpose

The Digital Intake Platform is the durable, tenant-aware entry boundary for automatic digital submissions, manual digital entry, and physical case entry. Every supported intake method creates the same submission record and follows the same prescription, validation, routing, Product Resolution, acceptance, and Billing Review sequence.

Digital Intake is not a scanner-specific application. Scanner and portal sources are adapters into a stable provider contract.

## Architecture

```text
Scanner / portal / upload / mail / courier / walk-in
                         |
                         v
                  Intake Submission
                         |
                         v
             Mandatory Digital Prescription
                         |
             +-----------+-----------+
             |                       |
             v                       v
      Clinical Validation      ObjectStorage files
             |
             v
       Routing Resolution
             |
             v
       Product Resolution
             |
             v
      Operational Case Creation
             |
             v
 Production -> QC -> Billing Review -> Billing command -> Invoice / Shipping
```

The final Billing command and intake-driven invoice generation are deferred. The existing verified Billing and shipment-delivery invoice behavior remains unchanged.

## Durable records

Migration `0005_digital_intake_platform.sql` introduces providers, Doctor Preference Profiles, Product Catalog, submissions, prescriptions, attachments, validation, routing, Product Resolution, Billing Review, and immutable intake history.

Migration `0006_intake_administration.sql` introduces Practice routing profiles, tenant routing defaults, and future Pricing Schedule records. Pricing Schedule records are independent from Product Catalog master records.

## Intake methods

### Automatic digital submission

Represents scanner, portal, secure-upload, or future API sources. Providers are registered through the common provider model.

### Manual digital entry

Used for emailed STL files, portal exports, external-storage downloads, or other digital records entered by laboratory staff.

### Physical case entry

Used for impressions, stone models, bite registrations, printed prescriptions, shade tabs, and physical implant components. A physical case still requires the in-system prescription before acceptance.

## Scanner Provider architecture

Provider types are official adapter, generic file provider, manual upload provider, simulator, and future SDK. `production_ready` distinguishes implemented production integration from a simulator or contract fixture.

Provider adapters own vendor authentication, payload translation, file retrieval, acknowledgement, and provider-specific retry behavior. They output the common submission command and attachment references.

Provider adapters must not own:

- prescription rules;
- clinical validation;
- routing policy;
- Product Resolution;
- pricing;
- Billing behavior.

No vendor-specific production adapter is claimed in Sprint 12.

## Lifecycle enforcement

Acceptance is rejected until all of the following exist:

1. completed Digital Prescription;
2. latest validation status is complete;
3. routing resolution;
4. at least one Product Resolution record;
5. an existing patient for operational case creation.

Acceptance creates an operational case through the established durable case API and creates a pending Billing Review.

## Routing precedence

Routing is independent from Scanner Providers and uses:

1. authorized case override;
2. restoration-level case override;
3. active Doctor Preference Profile;
4. active Practice routing profile;
5. tenant routing default;
6. manual review.

Doctor, Practice, and tenant configuration is administered through secured, auditable APIs and an administrator-only React workspace.

## Doctor Preference administration

Administrators can create versioned Doctor Preference Profiles, view history, and deactivate profiles. A newly saved version deactivates the previous active version.

Profiles support clinical defaults, material defaults, margin, contacts, occlusion, production preferences, preferred route, and preferred outsourcing partner. Prescription values override profile defaults.

## Practice and tenant routing administration

Administrators can create, update, and deactivate Practice routing profiles and set the tenant routing default. Routing changes create immutable audit events.

## Pricing Schedule foundation

Pricing Schedule records support standard, contract, promotion, and customer-override schedules, effective dates, Practice scope, priority, and future catalog-product schedule items.

No price calculation is performed in Digital Intake. Billing remains responsible for resolving customer prices, taxes, account configuration, promotions, contracts, invoice generation, and statements.

## Secure APIs

The platform provides secured endpoints for providers, catalog products, submissions, prescription, attachments, validation, routing, Product Resolution, acceptance and rejection, Billing Review, prescription PDF generation, Doctor Preferences, Practice routing, tenant defaults, and Pricing Schedule administration.

All endpoints use verified server sessions, CSRF protection for mutations, tenant isolation, Practice scope, server-side role enforcement, and immutable audit context.

## Attachments

The platform uses the existing ObjectStorage abstraction and durable `object_records`. Intake does not duplicate binary storage.

Supported kinds include STL, OBJ, PLY, DICOM, CBCT, X-ray, clinical photo, shade photo, PDF/document, ZIP intake package, and generated prescription PDF.

## Communications, notifications, and audit

Operational lifecycle events are appended to Clinical Communications. Notifications are generated for new submissions, validation failures, routing review, and Billing Review.

Security and change evidence is appended separately through immutable audit. `intake_history` is an immutable operational lifecycle log protected by PostgreSQL.

## React workspaces

- New Digital Submission;
- Manual Digital Entry;
- Physical Case Entry;
- Scanner Queue;
- Validation Queue;
- Routing Queue;
- Billing Review Queue;
- Smart Digital Prescription editor;
- attachment upload;
- validation, routing, Product Resolution, acceptance, and PDF actions;
- Doctor Preference administration;
- Practice and tenant routing administration;
- Pricing Schedule foundation administration.

## Legacy Case Intake compatibility

The established direct Case Intake remains operational to preserve verified ERP behavior. ADR-001 defines the future migration to a compatibility application command that internally creates and processes a Digital Intake submission.

Digital Intake is the target architecture for new entry workflows, but Sprint 12 does not claim that the legacy route has already been retired.

## Deferred

- official scanner-vendor production adapters and credential exchange;
- portal SDKs and inbound webhook infrastructure;
- malware scanning and archive inspection;
- DICOM and CBCT clinical processing;
- Pricing Schedule calculation;
- post-QC Billing command orchestration;
- automatic invoice generation from frozen Product Resolution;
- invoice and shipping-document bundling;
- automated statement inclusion;
- retirement of the legacy direct Case Intake route;
- external Doctor Portal submission.
