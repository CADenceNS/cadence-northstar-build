# Engineering Backlog

## Active

- [ ] Merge PR #2 after review.
- [ ] Review and merge PR #4 after PR #2.
- [ ] Review and merge PR #5 after PR #4.
- [ ] Review and merge PR #6 after PR #5.
- [ ] Review and merge PR #7 after PR #6.
- [ ] Review and merge PR #8 after PR #7.
- [ ] Complete and verify Sprint 8 Billing & Financial Engine.
- [ ] Sprint 9: implement PostgreSQL repositories for operational and financial domains.
- [ ] Add transactional invoice, line, adjustment, payment, statement, shipment-link, and audit tables with decimal money columns and unique constraints.
- [ ] Add migration, seed, backfill, rollback, and repository-contract integration tests for PostgreSQL.
- [ ] Replace development-only credentials with production identity and secure server sessions.
- [ ] Add server-side authorization enforcement for protected API resources.
- [ ] Replace all process-memory operational storage with durable database persistence.
- [ ] Replace base64 process-memory attachments and generated financial documents with durable encrypted object storage, malware scanning, and retention controls.

## Sprint 8 — Billing & Financial Engine

- [x] Define strict invoice, line, adjustment, payment, terms, statement, aging, and financial-metric contracts.
- [x] Add a `FinancialRepository` persistence boundary and in-memory implementation.
- [x] Generate invoices automatically when shipments are delivered.
- [x] Support multiple cases per invoice through multi-case shipments.
- [x] Add taxes, tax-exempt handling, discounts, credits, fees, payment terms, and total recalculation.
- [x] Add payment recording and invoice status updates.
- [x] Add AR aging, monthly statements, and dashboard financial metrics.
- [x] Add authenticated Billing React workspace and financial API endpoints.
- [x] Add Playwright coverage for delivery-to-invoice, adjustment, payment, statement, aging, and dashboard updates.
- [ ] Pass frozen install, typecheck, production build, service startup, financial API lifecycle, runtime regression, and all browser tests.
- [ ] Mark Sprint 8 complete only after every validation gate passes.

## Completed — Sprint 7 Shipping & Logistics

- [x] Add shipment contracts, queues, multi-case shipping, packing checklists, courier/tracking, barcode identifiers, history, delivery confirmation, metrics, API endpoints, React UI, and Playwright coverage.
- [x] Pass Sprint 7 validation and runtime regression pipelines.
- [x] Open focused Sprint 7 pull request #8 stacked on PR #7.

## Completed — Sprint 6 Quality Control Engine

- [x] Add configurable QC templates, outcomes, defect validation, digital sign-off, photos, history, quality metrics, API endpoints, React UI, and Playwright coverage.
- [x] Pass Sprint 6 validation and runtime regression pipelines.
- [x] Open focused Sprint 6 pull request #7 stacked on PR #6.

## Completed — Sprint 5 Production Workflow Engine

- [x] Add configurable production routes, assignments, queues, history, SLA metrics, API endpoints, React UI, and Playwright coverage.
- [x] Pass Sprint 5 validation and runtime regression pipelines.
- [x] Open focused Sprint 5 pull request #6 stacked on PR #5.

## Completed — Sprint 4 Patient & Case Intake

- [x] Add Patient and Case contracts, CRUD, associations, validation, numbering, turnaround, attachments, metrics, authenticated UI, and Playwright coverage.
- [x] Pass Sprint 4 validation and runtime regression pipelines.
- [x] Open focused Sprint 4 pull request #5 stacked on PR #4.

## Completed — Sprint 3 Practice & Doctor Management

- [x] Add Practice and Doctor CRUD, filtering, validation, account generation, communications, authenticated UI, and browser coverage.
- [x] Pass Sprint 3 validation and runtime regression pipelines.
- [x] Open focused Sprint 3 pull request #4 stacked on PR #2.

## Completed in PR #2

- [x] Establish API-backed authentication, session persistence, protected routes, dashboard loading, reproducible installation, and Playwright authentication coverage.
