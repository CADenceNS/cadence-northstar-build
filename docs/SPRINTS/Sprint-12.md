# Sprint 12 — Digital Intake Platform Foundation

## Status

Complete on implementation head `d08490f545b3abb34af98b5845ec157d3c898b6e`.

Sprint 12 establishes the durable Digital Intake foundation for automatic digital submissions, manual digital entry, and physical case entry while preserving the verified legacy Case Intake workflow.

## Implemented

- PostgreSQL migrations 0005 and 0006 with destructive rollback and clean reapplication.
- Provider-neutral scanner/source records distinguishing official adapters, generic files, manual uploads, simulators, and future SDKs.
- Unified intake submissions for automatic digital, manual digital, and physical entry.
- Mandatory versioned Smart Digital Prescription before acceptance.
- Restoration-aware validation for fixed, implant, removable, orthodontic, appliance, and diagnostic work.
- Multiple restorations, arches, tooth/unit positions, and implant positions.
- Doctor Preference Profiles with versioned clinical, material, production, routing, and outsource defaults.
- Practice routing profiles and tenant routing defaults.
- Routing precedence: case override, Doctor profile, Practice profile, tenant default, manual review.
- Price-free Product Catalog boundary and Product Resolution service.
- Deterministic SKU, category, subtype, material, quantity, department, and accounting-category resolution.
- Pricing Schedule records for future standard, contract, promotion, and customer-override pricing owned by Billing.
- Pending Billing Review after operational case creation and product freezing on approval.
- PostgreSQL-backed ObjectStorage attachments for STL, OBJ, PLY, CBCT, DICOM, X-rays, clinical photos, shade photos, ZIP packages, and generated prescription PDFs.
- Doctor, Laboratory, Production, and Outsourcing prescription PDF copies generated from the stored prescription.
- Intake communications, internal notifications, immutable audit events, and immutable intake history.
- Secure APIs using the verified Sprint 10 server session, CSRF, role authorization, tenant context, and audit context.
- React Digital Intake and Intake Administration workspaces.
- Legacy Case Intake retained without automatic redirection.
- ADR operating policy and ADRs for legacy compatibility, Product Catalog/Pricing separation, scanner adapters, and future event-driven Billing Review.

## Root causes resolved

1. The first integration fixture used nonexistent tenant columns. It was aligned with the established tenant schema.
2. The first attachment test used in-memory ObjectStorage against a durable foreign key. Digital Intake tests now use `PostgresObjectStorage` exclusively.
3. The initial Product Catalog migration carried customer-price columns. Migration 0006 removes them and establishes Pricing Schedules as the exclusive future customer-pricing source.
4. Product Resolution originally wrote directly to Product Catalog. The secure gateway now registers a shared price-free Product Catalog foundation before the intake router, and Product Resolution uses that foundation.

## Verified

Sprint 12 Validation run `30407654085` passed on `d08490f545b3abb34af98b5845ec157d3c898b6e`:

- frozen dependency installation;
- strict TypeScript;
- shared, API, and React production builds;
- migrations 0001–0006;
- repository, PostgreSQL, Sprint 10 security, and Sprint 11 communications integrations;
- Digital Intake and administration integrations;
- all supported intake ObjectStorage kinds with durable `object_records`;
- routing precedence, Product Resolution, pricing separation, tenant isolation, authorization, notifications, communications, and immutable audit/history;
- migrations 0005–0006 rollback and reapplication;
- secure API lifecycle;
- complete inherited and Sprint 12 Playwright suite, including administration workflows.

Runtime Validation run `30407654184` passed on the same head, including reproducible installation, migrations 0001–0006, secure API and React startup, authentication lifecycle, and complete browser regression execution.

## Architectural review

Confirmed:

- Scanner Providers remain adapters outside the transactional intake domain.
- Digital Intake owns submission, prescription, validation orchestration, acceptance, and intake history.
- Product Resolution owns product identity and uses Product Catalog through the price-free boundary.
- Pricing Schedules own future customer-pricing configuration.
- Billing owns pricing calculation, taxes, invoices, payments, and statements.
- Routing is independent from scanner source.
- Communications remain operational events; security audit remains separate and immutable.
- Product Catalog contains no customer-pricing columns after migration 0006.
- Legacy Case Intake remains production compatible and is governed by ADR-001.

No unresolved architectural deviation remains within Sprint 12 scope.

## Definition of Done

- [x] Automatic, manual digital, and physical intake use one lifecycle.
- [x] Digital Prescription is mandatory before acceptance.
- [x] Restoration-aware validation is operational.
- [x] Routing precedence is implemented and verified.
- [x] Product Resolution is catalog-backed and price-free.
- [x] Billing Review is created and approved products freeze.
- [x] Prescription PDFs are generated through ObjectStorage.
- [x] Communications, notifications, audit, and immutable history are recorded.
- [x] Doctor Preference, Practice routing, tenant routing, and Pricing Schedule administration are verified.
- [x] Legacy Case Intake remains compatible.
- [x] Migrations, rollback, Runtime Validation, and Playwright pass.

## Deferred

- production scanner-vendor adapters, credentials, webhooks, and portal SDKs;
- malware scanning and archive inspection;
- DICOM/CBCT clinical processing;
- Pricing Schedule calculation and eligibility rules;
- post-QC Billing command and transactional-outbox orchestration;
- automatic invoice generation from frozen intake products;
- invoice/shipment document bundling and automatic statement inclusion;
- controlled migration of legacy Case Intake into an internal Digital Intake command.

## Technical debt

- The legacy intake implementation remains concentrated in a large route module and should be separated into application services after the foundation stabilizes.
- Product Catalog and routing repositories should receive typed repository interfaces rather than continued direct SQL in handlers.
- The existing Runtime Validation workflow still mutates legacy source compatibility state during CI and should eventually be replaced by deterministic fixtures.
- Upload malware scanning, quarantine, retention, and managed cloud ObjectStorage remain required before General Availability.
