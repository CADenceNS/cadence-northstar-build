# Sprint 04 — Patient & Case Intake

## Status

Implementation complete; validation pending on the Sprint 4 pull request.

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

- [ ] Clean frozen-lockfile installation passes.
- [ ] TypeScript validation passes without `any`, `ts-ignore`, or optional-contract weakening.
- [ ] Production build passes.
- [ ] API and frontend start successfully.
- [ ] Patient create, read, update, delete, search, filtering, and relationship validation pass.
- [ ] Case create, read, update, delete, search, automatic numbering, and turnaround calculation pass.
- [ ] Universal tooth and arch clinical validation pass.
- [ ] Supported clinical attachment upload and display pass.
- [ ] Dashboard metrics update after Patient and Case changes.
- [ ] Authentication and protected-shell regression tests pass.
- [ ] Sprint 3 Practice/Doctor browser regression tests pass.
- [ ] Sprint 4 Patient/Case Playwright lifecycle passes.

## Out of scope

- Durable database persistence.
- Production identity provider changes.
- Durable encrypted object storage and malware scanning.
- Billing, shipping, CAD design, and production-routing expansion.
