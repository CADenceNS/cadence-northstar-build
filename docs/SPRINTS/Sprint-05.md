# Sprint 05 — Production Workflow Engine

## Status

Complete and verified on PR #6.

## Objective

Deliver an authenticated laboratory production lifecycle from Receiving through Shipping with configurable routing, technician assignment, auditable transitions, SLA tracking, department queues, and dashboard workload visibility.

## Scope

- Configurable department routes using Receiving, Case Review, Model, CAD, Manufacturing, Ceramics, QC, and Shipping.
- Technician directory with department eligibility.
- Department work queues and status filters.
- Queued, in-progress, blocked, and completed production states.
- Timestamped status history with actor and technician attribution.
- SLA due timestamps per department, adjusted for rush cases.
- Overdue and in-progress production dashboard metrics.
- Department workload summaries.
- Production API endpoints and authenticated React UI.
- Playwright coverage through the complete configured route.

## Acceptance gates

- [x] Frozen-lockfile installation passes.
- [x] TypeScript validation passes without contract weakening.
- [x] Production build passes.
- [x] API and frontend start successfully.
- [x] Work-item creation validates the linked clinical case and route.
- [x] Routes begin at Receiving and end at Shipping.
- [x] Technician assignment validates department eligibility.
- [x] Transitions follow the configured route in order.
- [x] Every transition records timestamp, actor, technician, status, department, and note.
- [x] SLA and overdue calculations pass.
- [x] Department workload and dashboard metrics pass.
- [x] Authentication, Sprint 3, and Sprint 4 regression tests pass.
- [x] Sprint 5 full production Playwright lifecycle passes.

## Verified runs

- Sprint 05 Validation: `30231185477`
- Runtime Validation: `30231185467`

## Persistence note

Sprint 5 intentionally retains the current in-memory persistence model. Database migration is tracked separately in `docs/BACKLOG.md` and must include transactional work-item state, immutable history events, route configuration, technician assignments, SLA timestamps, and indexes for department queues and overdue queries.

## Out of scope

- Durable database persistence.
- Production identity provider changes.
- Barcode scanning hardware.
- Billing and invoicing triggers.
- Automated external notifications.
