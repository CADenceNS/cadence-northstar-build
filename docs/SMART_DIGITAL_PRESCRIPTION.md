# Smart Digital Prescription

## Purpose

The Smart Digital Prescription is the authoritative clinical intake record for every Digital Intake submission. A submission cannot be accepted or converted into an operational case until a valid stored prescription exists.

## Ownership

Digital Intake owns prescription capture, versioning, completion state, validation input, and printable copies. Production, QC, outsourcing, Product Resolution, Billing, future CAD services, and future AI services consume the stored prescription; they do not maintain competing copies.

## Automatic population

The application populates Practice, Doctor, patient reference, shipping and billing context from existing NorthStar records when those records are selected. Active Doctor Preference Profiles supply defaults before case-specific values are applied. Case-specific values always override profile defaults.

## Restoration-aware structure

A prescription supports multiple restorations. Each restoration stores category, type, subtype, material, quantity or units, tooth numbers, implant positions, pontics, abutments, arches, implant system, scan body, Ti-Base, MUA, library information, and an optional case routing override.

The React workspace displays relevant controls based on the restoration selection:

- implant-related work requires implant-system and implant-position data;
- removable work uses arch selection;
- fixed work uses tooth or unit selection;
- multiple restorations may coexist in one prescription.

## Clinical information

Structured clinical information supports shade, stump shade, margin design, contacts, occlusion, surface texture, anatomy, implant information, production notes, and special instructions. The large notes fields remain available for information that does not fit a structured field.

## Validation rules

Validation is evaluated from the stored prescription rather than browser state. Current rules require:

- Practice;
- Doctor;
- patient reference;
- at least one restoration;
- restoration category and type;
- material except where not clinically applicable;
- tooth numbers or units for fixed work;
- at least two unit positions for bridges;
- arches for removable work;
- implant system and implant positions for implant work.

A manual routing override can result in `requires-routing-review`. Duplicate detection compares tenant, Practice, Doctor, and patient reference against active submissions.

Supported statuses are complete, incomplete, invalid, duplicate, requires clinical review, requires routing review, accepted, and rejected.

## Completion and versioning

Saving a prescription creates or increments its stored version. Every change records authenticated actor context in immutable audit and intake history. Prescription completion also creates an operational communication event.

## Attachments

Prescription-related STL, OBJ, PLY, DICOM, CBCT, X-ray, image, PDF, document, and ZIP-package files are stored through the shared ObjectStorage abstraction. The prescription references durable object records; it does not duplicate binary storage.

## Printable copies

Authorized users can generate Doctor, Laboratory, Production, and Outsourcing copies. Each PDF is generated from the stored prescription and saved through ObjectStorage. The copies are representations of one authoritative record, not separate editable prescriptions.

## Security

All prescription APIs require a verified server session, CSRF protection for mutations, server-side role authorization, tenant isolation, and Practice scoping inherited from the NorthStar security gateway.

## Deferred

- electronic prescribing signatures;
- template libraries managed by product teams;
- portal-specific Doctor editing policies;
- advanced conditional fields supplied by future CAD and AI services;
- formal records retention and legal-hold automation.
