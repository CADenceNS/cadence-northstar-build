# Engineering Backlog

## Active

- [ ] Merge PR #2 after review.
- [ ] Review and merge PR #4 after PR #2.
- [ ] Review and merge PR #5 after PR #4.
- [ ] Review and merge PR #6 after PR #5.
- [ ] Review and merge PR #7 after PR #6.
- [ ] Complete and verify Sprint 7 Shipping & Logistics.
- [ ] Replace development-only credentials with production identity and secure server sessions.
- [ ] Add server-side authorization enforcement for protected API resources.
- [ ] Replace all process-memory operational storage with durable database persistence.
- [ ] Migrate production routes, assignments, transitions, SLA events, and status history to transactional database tables.
- [ ] Migrate QC templates, template versions, inspection results, defects, outcomes, inspector sign-offs, and QC history to transactional database tables.
- [ ] Migrate shipments, shipment-case joins, packing checklists, courier/tracking events, delivery confirmations, and barcode identifiers to transactional database tables.
- [ ] Add immutable production, QC, and shipping event audit storage with indexes for queues, outcomes, tracking numbers, and delivery status.
- [ ] Replace base64 process-memory attachments, QC photos, and future shipping documents with durable encrypted object storage, malware scanning, and retention controls.

## Sprint 7 — Shipping & Logistics

- [x] Define strict shipment, courier, packing-checklist, queue, tracking, barcode, history, and logistics-metric contracts.
- [x] Add Ready to Ship, Awaiting Pickup, Shipped, and Delivered queues.
- [x] Add single-case, partial, and multi-case shipment creation.
- [x] Add packing checklist enforcement, courier selection, tracking management, and ordered status transitions.
- [x] Add barcode-ready case and shipment identifiers with placeholder scanner-compatible values.
- [x] Add timestamped, user-attributed shipping history and delivery confirmation.
- [x] Add authenticated Shipping React workspace and dashboard logistics metrics.
- [x] Add shipment, queue, transition, ready-case, and metrics API endpoints.
- [x] Add Playwright coverage from QC approval through delivery confirmation.
- [ ] Pass frozen install, typecheck, production build, service startup, shipping API lifecycle, runtime regression, and all browser tests.
- [ ] Mark Sprint 7 complete only after every validation gate passes.

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
- [x] Pass Sprint 6 validation and runtime regression pipelines.
- [x] Open focused Sprint 6 pull request #7 stacked on PR #6.

## Completed — Sprint 5 Production Workflow Engine

- [x] Define strict department, technician, route, work-item, status-history, SLA, and workload contracts.
- [x] Add configurable production routes, assignments, queues, history, SLA metrics, API endpoints, React UI, and Playwright coverage.
- [x] Pass Sprint 5 validation and runtime regression pipelines.
- [x] Open focused Sprint 5 pull request #6 stacked on PR #5.

## Completed — Sprint 4 Patient & Case Intake

- [x] Define strict Patient, Clinical Case, attachment, arch, tooth, shade, and rush-priority contracts.
- [x] Add Patient and Case CRUD, associations, clinical validation, numbering, turnaround, and attachment support.
- [x] Pass Sprint 4 validation and runtime regression pipelines.
- [x] Open focused Sprint 4 pull request #5 stacked on PR #4.

## Completed — Sprint 3 Practice & Doctor Management

- [x] Add Practice and Doctor CRUD, filtering, validation, account generation, communications, authenticated UI, and browser coverage.
- [x] Pass Sprint 3 validation and runtime regression pipelines.
- [x] Open focused Sprint 3 pull request #4 stacked on PR #2.

## Completed in PR #2

- [x] Establish API-backed authentication, session persistence, protected routes, dashboard loading, reproducible installation, and Playwright authentication coverage.
