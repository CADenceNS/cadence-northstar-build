# Sprint 05 — Production Workflow Engine

## Status

Implementation complete; validation pending on the Sprint 5 pull request.

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

- [ ] Frozen-lockfile installation passes.
- [ ] TypeScript validation passes without contract weakening.
- [ ] Production build passes.
- [ ] API and frontend start successfully.
- [ ] Work-item creation validates the linked clinical case and route.
- [ ] Routes must begin at Receiving and end at Shipping.
- [ ] Technician assignment validates department eligibility.
- [ ] Transitions follow the configured route in order.
- [ ] Every transition records timestamp, actor, technician, status, department, and note.
- [ ] SLA and overdue calculations pass.
- [ ] Department workload and dashboard metrics pass.
- [ ] Authentication, Sprint 3, and Sprint 4 regression tests pass.
- [ ] Sprint 5 full production Playwright lifecycle passes.

## Persistence note

Sprint 5 intentionally retains the current in-memory persistence model. Database migration is tracked separately in `docs/BACKLOG.md` and must include transactional work-item state, immutable history events, route configuration, technician assignments, SLA timestamps, and indexes for department queues and overdue queries.

## Out of scope

- Durable database persistence.
- Production identity provider changes.
- Barcode scanning hardware.
- Billing and invoicing triggers.
- Automated external notifications.
