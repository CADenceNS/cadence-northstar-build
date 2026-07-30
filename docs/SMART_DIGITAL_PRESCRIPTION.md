# Smart Digital Prescription

## Purpose

The Smart Digital Prescription is the authoritative clinical intake record for every Digital Intake submission. A submission cannot be accepted or converted into an operational case until a valid stored prescription exists.

## Ownership

Digital Intake owns prescription capture, versioning, completion state, validation input, and printable copies. Production, QC, outsourcing, Product Resolution, Billing, future CAD services, and future AI services consume the stored prescription; they do not maintain competing copies.

## Automatic population

The application populates Practice, Doctor, patient reference, shipping and billing context from selected NorthStar records. Active Doctor Preference Profiles provide clinical, material, production, routing, and outsource defaults. Case-specific prescription values override profile defaults.

## Dynamic restoration behavior

A prescription supports multiple restorations in one submission. Each restoration may store category, type, subtype, material, quantity, units, tooth numbers, implant positions, pontics, abutments, arches, implant system, scan body, Ti-Base, MUA, library information, and an optional route override.

The React workspace adapts controls by restoration type:

- fixed, appliance, and orthodontic work uses tooth/unit selection;
- bridges require multiple unit positions;
- removable work uses maxillary and/or mandibular arch selection;
- implant work requires implant system and implant positions;
- multiple restoration categories may coexist in one prescription.

## Clinical information

Structured clinical information supports material, shade, stump shade, margin design, contacts, occlusion, surface texture, anatomy, implant information, production preferences, production notes, and special instructions. Large notes fields remain available for unstructured clinical detail.

## Server-side validation

Validation is evaluated from the stored prescription rather than browser state. Current rules require:

- Practice and Doctor;
- patient reference;
- at least one restoration;
- restoration category and type;
- material except where not clinically applicable;
- tooth numbers or units for fixed, appliance, and orthodontic work;
- at least two positions for bridges;
- at least one arch for removable work;
- implant system and implant positions for implant work.

Duplicate detection is tenant scoped and compares Practice, Doctor, patient reference, and active submissions. Supported results include complete, incomplete, invalid, duplicate, requires clinical review, requires routing review, accepted, and rejected.

## Versioning and evidence

Saving creates or increments the stored prescription version. Each change records authenticated actor context in immutable audit and intake history and appends an operational communication event.

## Attachments

Prescription-related STL, OBJ, PLY, CBCT, DICOM, X-ray, clinical photo, shade photo, document, and ZIP-package files use PostgreSQL-backed ObjectStorage and durable `object_records`. No binary bytes are duplicated in prescription tables.

## Printable copies

Authorized users can generate Doctor, Laboratory, Production, and Outsourcing copies. Each PDF is generated from the stored prescription, saved through ObjectStorage, and returned for printing. Copies are representations of one authoritative record rather than separate editable records.

## Security

All APIs require the verified server session, CSRF protection for mutations, server-side role authorization, tenant isolation, and immutable audit context.

## Verified

Sprint 12 integration and Playwright coverage verifies:

- fixed, implant, removable, orthodontic, and appliance prescriptions;
- multiple restorations and arches;
- profile default population and case overrides;
- mandatory completion rules;
- notes and attachment persistence;
- PDF generation and printing workflow;
- role authorization and tenant isolation.

Evidence: Sprint 12 Validation run `30407654085` on implementation head `d08490f545b3abb34af98b5845ec157d3c898b6e`.

## Deferred

- electronic signatures;
- portal-specific Doctor editing policies;
- advanced CAD/AI conditional fields;
- managed template libraries;
- retention and legal-hold automation.
