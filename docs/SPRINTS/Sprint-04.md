# Sprint 04 — Patient & Case Intake

## Status

Complete. Sprint 04 Validation run `30228941923` and Runtime Validation run `30228941920` passed all required gates.

## Objective

Deliver authenticated Patient Management and clinical Case Intake integrated with the verified Practice, Doctor, authentication, dashboard, API, and browser lifecycle.

## Scope

- Patient CRUD, search, filtering, status, notes, and Practice/Doctor associations.
- Case CRUD with automatic `NS-YYMMDD-###` numbering.
- Universal tooth numbers 1–32 and maxillary, mandibular, both, or not-applicable arch selection.
- Restoration, material, shade, stump shade, rush priority, prescription notes, and status.
- Turnaround-date calculation using business days: 10 standard fixed, 14 standard implant/removable/surgical, 5 rush fixed, and 7 rush extended cases.
- Attachments for STL, OBJ, PLY, DICOM/CBCT, RX/PDF, and clinical photos.
- Required clinical-field and relationship validation.
- Dashboard active-patient, open-case, rush-case, due-today, at-risk, QC, and shipment metrics.
- Playwright browser lifecycle coverage.

## Acceptance gates

- [x] Clean frozen-lockfile installation passes.
- [x] TypeScript validation passes without `any`, `ts-ignore`, or optional-contract weakening.
- [x] Production build passes.
- [x] API and frontend start successfully.
- [x] Patient create, read, update, delete, search, filtering, and relationship validation pass.
- [x] Case create, read, update, delete, search, automatic numbering, and turnaround calculation pass.
- [x] Universal tooth and arch clinical validation pass.
- [x] Supported clinical attachment upload and display pass.
- [x] Dashboard metrics update after Patient and Case changes.
- [x] Authentication and protected-shell regression tests pass.
- [x] Sprint 3 Practice/Doctor browser regression tests pass.
- [x] Sprint 4 Patient/Case Playwright lifecycle passes.

## Out of scope

- Durable database persistence.
- Production identity provider changes.
- Durable encrypted object storage and malware scanning.
- Billing, shipping, CAD design, and production-routing expansion.
