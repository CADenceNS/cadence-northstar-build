# Engineering Backlog

## Active

- [ ] Merge PR #2 after review.
- [ ] Review and merge PR #4 after PR #2.
- [ ] Review and merge PR #5 after PR #4.
- [ ] Review and merge PR #6 after PR #5.
- [ ] Review and merge PR #7 after PR #6.
- [ ] Replace development-only credentials with production identity and secure server sessions.
- [ ] Add server-side authorization enforcement for protected API resources.
- [ ] Replace all process-memory operational storage with durable database persistence.
- [ ] Migrate production routes, assignments, transitions, SLA events, and status history to transactional database tables.
- [ ] Migrate QC templates, template versions, inspection results, defects, outcomes, inspector sign-offs, and QC history to transactional database tables.
- [ ] Add immutable production and QC event audit storage with indexes for queues, technician assignments, outcomes, defects, and SLA queries.
- [ ] Replace base64 process-memory attachments and QC photos with durable encrypted object storage, malware scanning, and retention controls.

## Completed — Sprint 6 Quality Control Engine

- [x] Define strict template, checklist, outcome, defect, photo, sign-off, history, and quality-metric contracts.
- [x] Add configurable QC templates by restoration type.
- [x] Add Pass, Rework, Hold, Remake, and Doctor Clarification outcomes.
- [x] Add required checklist enforcement and categorized defect validation.
- [x] Add inspector-attributed digital sign-off and timestamped QC history.
- [x] Add QC photo attachment support.
- [x] Add pass rate, remake rate, rework rate, first-pass yield, outcome counts, and defect trends.
- [x] Add authenticated QC React workspace and dashboard quality metrics.
- [x] Add QC template, inspection, photo, history, and metric API endpoints.
- [x] Add Playwright coverage for QC sign-off, defects, photos, history, and dashboard metrics.
- [x] Pass frozen install, typecheck, production build, service startup, QC API lifecycle, runtime regression, and all browser tests in Sprint 06 Validation run `30234013933` and Runtime Validation run `30234013970`.
- [x] Open focused Sprint 6 pull request #7 stacked on PR #6.

## Completed — Sprint 5 Production Workflow Engine

- [x] Define strict department, technician, route, work-item, status-history, SLA, and workload contracts.
- [x] Add configurable routes covering Receiving, Case Review, Model, CAD, Manufacturing, Ceramics, QC, and Shipping.
- [x] Add technician assignment with department eligibility validation.
- [x] Add department work queues, status filtering, and overdue filtering.
- [x] Add timestamped and user-attributed production history.
- [x] Add SLA calculation and department workload metrics.
- [x] Add authenticated Production Workflow React UI.
- [x] Add API endpoints for technicians, work items, assignments, transitions, queues, and workload.
- [x] Add Playwright coverage for the complete production route.
- [x] Pass Sprint 5 validation and runtime regression pipelines.
- [x] Open focused Sprint 5 pull request #6 stacked on PR #5.

## Completed — Sprint 4 Patient & Case Intake

- [x] Define strict Patient, Clinical Case, attachment, arch, tooth, shade, and rush-priority contracts.
- [x] Add Patient and Case CRUD, associations, clinical validation, numbering, turnaround, and attachment support.
- [x] Add authenticated Patient Management and Case Intake pages.
- [x] Add dashboard clinical metrics and Playwright lifecycle coverage.
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
