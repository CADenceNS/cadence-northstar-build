# Engineering Backlog

## Active

- [ ] Merge PR #2 after review.
- [ ] Review and merge PR #4 after PR #2.
- [ ] Review and merge PR #5 after PR #4.
- [ ] Complete and verify Sprint 5 Production Workflow Engine.
- [ ] Replace development-only credentials with production identity and secure server sessions.
- [ ] Add server-side authorization enforcement for protected API resources.
- [ ] Replace all process-memory operational storage with durable database persistence.
- [ ] Migrate production routes, assignments, transitions, SLA events, and status history to transactional database tables.
- [ ] Replace base64 process-memory attachments with durable encrypted object storage.

## Sprint 5 — Production Workflow Engine

- [x] Define strict department, technician, route, work-item, status-history, SLA, and workload contracts.
- [x] Add configurable routes covering Receiving, Case Review, Model, CAD, Manufacturing, Ceramics, QC, and Shipping.
- [x] Add technician assignment with department eligibility validation.
- [x] Add department work queues, status filtering, and overdue filtering.
- [x] Add timestamped and user-attributed production history.
- [x] Add SLA calculation and department workload metrics.
- [x] Add authenticated Production Workflow React UI.
- [x] Add API endpoints for technicians, work items, assignments, transitions, queues, and workload.
- [x] Add Playwright coverage for the complete production route.
- [ ] Pass frozen install, typecheck, production build, service startup, API lifecycle, runtime regression, and Playwright verification.
- [ ] Mark Sprint 5 complete only after every validation gate passes.

## Completed — Sprint 4 Patient & Case Intake

- [x] Define strict Patient, Clinical Case, attachment, arch, tooth, shade, and rush-priority contracts.
- [x] Add Patient CRUD, search, status filtering, validation, and Practice/Doctor associations.
- [x] Add Case CRUD, automatic case numbering, Universal tooth validation, arch selection, and clinical validation.
- [x] Add restoration, material, shade, stump shade, rush priority, and turnaround-date calculation.
- [x] Add STL, OBJ, PLY, DICOM/CBCT, RX, and photo attachment endpoints and UI upload support.
- [x] Add authenticated Patient Management and Case Intake pages.
- [x] Add dashboard active-patient, open-case, rush-case, due-today, and at-risk metrics.
- [x] Add Playwright Patient and Case lifecycle coverage.
- [x] Pass Sprint 4 validation and runtime regression pipelines.
- [x] Open focused Sprint 4 pull request #5 stacked on PR #4.

## Completed — Sprint 3 Practice & Doctor Management

- [x] Define shared Practice, Doctor, office-manager, notes, and communication contracts.
- [x] Add Practice and Doctor CRUD, filtering, validation, account generation, and communications.
- [x] Build authenticated Practice Management and Doctor Management pages.
- [x] Remove duplicate Doctor active-state representation and use `status` exclusively.
- [x] Pass frozen install, typecheck, production build, startup, and Playwright verification.
- [x] Open focused Sprint 3 pull request #4 stacked on PR #2.

## Completed in PR #2

- [x] Establish executable API and web startup validation.
- [x] Route React login through `POST /api/auth/login`.
- [x] Keep authentication in one application-level session state.
- [x] Persist the authenticated user across browser refreshes.
- [x] Protect the application shell and internal views when no session exists.
- [x] Clear authentication state and return to login on logout.
- [x] Add Playwright authentication lifecycle coverage.
- [x] Commit and verify the generated `pnpm-lock.yaml`.
