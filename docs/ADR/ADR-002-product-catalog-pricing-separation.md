# ADR-002 — Separate Product Catalog from Pricing Schedules

- **Status:** Accepted
- **Date:** 2026-07-28
- **Decision owners:** NorthStar Architecture and Billing domains

## Context

Digital Intake must identify the operational and accounting products represented by a prescription, while Billing must determine the amount charged to a customer. Mixing customer prices into Product Catalog would couple intake, promotions, contracts, tax configuration, and customer overrides to the product identity model.

## Decision

Product Catalog owns stable product identity and operational classification only:

- SKU and product name
- restoration category, type, subtype, and material
- department and accounting category
- internal and outsource cost metadata
- tax classification and turnaround category
- active status

Pricing Schedules own future customer-facing price configuration, including standard schedules, contracts, promotions, and customer overrides. Billing will resolve applicable schedules and generate invoices. Digital Intake and Product Resolution never calculate or expose customer prices.

Product Resolution may ensure that a catalog identity exists, but it returns only price-free product-identification fields.

## Consequences

- Product Catalog can evolve independently of customer agreements.
- Pricing precedence can be implemented in Billing without changing scanner or intake contracts.
- Catalog APIs reject customer-price fields.
- Migration 0006 removes legacy customer-price columns introduced by the initial foundation.
- Billing integration requires a future dedicated command consuming frozen Product Resolution records.

## Alternatives rejected

- Store a default customer price on each catalog row: rejected because it creates ambiguous ownership and customer-specific coupling.
- Resolve pricing during submission: rejected because Doctors must not see internal pricing and Billing owns financial policy.
