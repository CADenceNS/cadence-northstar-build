# ADR-004 — Use an Event-Driven Billing Review Handoff

- **Status:** Accepted for future implementation
- **Date:** 2026-07-28
- **Decision owners:** NorthStar Architecture, Workflow, Quality Control, and Billing domains

## Context

Digital Intake identifies products and creates a pending Billing Review when an operational case is accepted. Final invoice generation must occur only after production and Quality Control are complete. Directly invoking Billing from Digital Intake or Quality Control would create cross-domain coupling and fragile transaction boundaries.

## Decision

The long-term handoff will use an explicit application event, implemented through the transactional outbox when background processing is introduced.

The intended sequence is:

1. Digital Intake resolves price-free product identities.
2. Accepted intake creates the operational case and a pending Billing Review.
3. Quality Control completion publishes a billing-review-ready event.
4. Billing consumes the event, resolves Pricing Schedules and account rules, permits authorized review adjustments, freezes approved billable products, and generates the invoice.

Sprint 12 does not implement asynchronous delivery or change the existing shipment-driven invoice behavior. The ADR records the approved integration direction.

## Consequences

- Billing remains the sole owner of pricing and invoice generation.
- Digital Intake remains independent of invoice internals.
- Retries, idempotency, and operational visibility become explicit requirements.
- The future Workflow Engine can coordinate status without owning financial policy.
- Existing billing behavior remains supported until the event-driven command is implemented and verified.

## Alternatives rejected

- Generate invoices directly during intake acceptance: rejected because production and QC are incomplete.
- Make QC call Billing internals synchronously: rejected because it creates tight cross-domain coupling.
