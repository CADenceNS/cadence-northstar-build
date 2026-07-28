# Digital Intake Platform

## Purpose

The Digital Intake Platform is the durable, tenant-aware entry boundary for automatic digital submissions, manual digital entry, and physical case entry. Every supported intake method creates the same `intake_submissions` record and must complete the same Digital Prescription, validation, routing, product-resolution, acceptance, and billing-review stages.

This module is not a scanner-specific application. Scanner and portal sources are adapters into a stable provider contract.

## Current architecture

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
  Production -> QC -> Billing Review -> Existing Billing / Shipping
```

## Durable records

Migration `0005_digital_intake_platform.sql` introduces:

- `scanner_providers`
- `doctor_preference_profiles`
- `product_catalog`
- `intake_submissions`
- `digital_prescriptions`
- `intake_attachments`
- `intake_validations`
- `intake_routing_resolutions`
- `intake_product_resolutions`
- `intake_billing_reviews`
- immutable `intake_history`

All records include tenant ownership. Submission queues are indexed by tenant, status, and received time.

## Intake methods

### Automatic digital submission

Represents a scanner, portal, secure upload, or future API source. The provider must be registered in `scanner_providers`. Provider metadata distinguishes:

- official adapter
- generic file provider
- manual upload provider
- simulator
- future SDK

`production_ready` explicitly separates a simulator or contract test from an implemented production integration.

### Manual digital entry

Used for emailed files, external-storage downloads, portal exports, and other digital records manually entered by laboratory staff.

### Physical case entry

Used for impressions, stone models, bite registrations, printed prescriptions, shade tabs, and physical implant components. Physical cases still receive a digital submission record and cannot be accepted until the in-system Digital Prescription is complete.

## Lifecycle enforcement

A submission begins at `prescription-required`. Acceptance is rejected until all of the following exist:

1. completed Digital Prescription;
2. latest validation status is `complete`;
3. routing resolution exists;
4. at least one product-resolution record exists;
5. an existing patient record is linked for operational case creation.

Acceptance creates an operational case through the existing durable case API and creates a pending Billing Review record.

## Secure APIs

Current endpoints include:

- `GET/POST /api/intake/providers`
- `GET/POST /api/intake/catalog`
- `GET/POST /api/intake/submissions`
- `GET /api/intake/submissions/:id`
- `PUT /api/intake/submissions/:id/prescription`
- `POST /api/intake/submissions/:id/attachments`
- `POST /api/intake/submissions/:id/validate`
- `POST /api/intake/submissions/:id/route`
- `POST /api/intake/submissions/:id/resolve-products`
- `POST /api/intake/submissions/:id/accept`
- `POST /api/intake/submissions/:id/reject`
- `POST /api/intake/submissions/:id/billing-review`
- `POST /api/intake/submissions/:id/prescription-pdf`

All endpoints require the verified Sprint 10 server session. Intake writes are restricted to System Administrator, Laboratory Administrator, Office Manager, Customer Service, and Billing roles.

## Attachments

The platform uses the existing `ObjectStorage` abstraction and `object_records`. It does not duplicate binary storage.

Supported intake object kinds now include STL, OBJ, PLY, DICOM, CBCT, X-ray, clinical photo, shade photo, PDF/document, ZIP intake package, and generated prescription PDF.

## Communications, notifications, and audit

Operational lifecycle messages are appended to the Clinical Communications domain as system events. Internal notifications are generated for new submissions, validation failures, routing review, and Billing Review.

Security and change evidence is appended separately through the immutable audit repository. Full clinical notes are not copied into security audit records.

`intake_history` is an additional immutable operational lifecycle log protected by a PostgreSQL trigger.

## React workspaces

The current React workspace provides:

- New Digital Submission
- Manual Digital Entry through the universal creation form
- Physical Case Entry through the same form
- Scanner Queue
- Validation Queue
- Routing Queue
- Billing Review Queue
- Smart Digital Prescription editor
- attachment upload
- validation, routing, product-resolution, acceptance, and PDF actions

## Implemented foundation

- provider-neutral submission records;
- unified manual, automatic, and physical intake lifecycle;
- mandatory prescription gate;
- restoration-aware validation foundation;
- routing precedence foundation;
- catalog-backed product identification;
- price-free submission responses;
- operational case creation;
- pending Billing Review and product freeze on approval;
- generated Doctor, Laboratory, Production, and Outsourcing prescription copies;
- communication, notification, audit, and immutable intake-history participation.

## Deferred

- official scanner-vendor production adapters and credential exchange;
- portal SDKs and inbound webhook infrastructure;
- malware scanning, archive inspection, and DICOM/CBCT clinical processing;
- Practice-level and tenant-admin preference editors;
- customer-specific pricing schedules and promotion engines;
- automatic post-QC invoice generation from Billing Review;
- invoice-print bundling with shipment documents;
- enforced retirement of direct legacy case creation after migration of all existing workflows;
- external Doctor Portal submission.
