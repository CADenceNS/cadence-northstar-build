# Product Resolution

## Purpose

Product Resolution converts restorations in a completed Digital Prescription into stable billable product identities. It determines what was ordered; it does not calculate what the customer pays.

## Permanent boundary

```text
Digital Intake
      ↓
Product Resolution
      ↓
Billing command
      ↓
Pricing Schedule resolution
      ↓
Invoice
```

Digital Intake owns submission and prescription data. Product Resolution owns product identity. Product Catalog owns reusable SKU and operational classification. Pricing Schedules own future customer-pricing configuration. Billing owns price calculation, taxes, invoice generation, payments, and statements.

## Inputs

Product Resolution consumes the stored prescription’s restoration category, type, subtype, material, quantity, units, teeth, implant positions, arches, and tenant Product Catalog.

## Outputs

Each resolution records:

- SKU;
- product category;
- restoration type and subtype;
- material;
- quantity;
- production department;
- accounting category;
- Product Catalog reference;
- authenticated resolver and timestamp.

Quantity is derived from the explicit quantity, units, tooth positions, arches, or a minimum value of one.

## Product Catalog foundation

The shared price-free Product Catalog foundation is registered before the Digital Intake router. Both catalog administration and Product Resolution use this boundary.

Product Catalog stores:

- SKU and product name;
- restoration category and subtype;
- material;
- production department;
- accounting category;
- internal and outsource cost metadata;
- tax classification;
- turnaround category;
- active state.

Migration 0006 removes the initial customer-price and promotional-price columns. Catalog APIs reject customer-pricing fields. Product Resolution responses exclude all price fields.

When no matching identity exists, Product Resolution creates or updates a deterministic tenant catalog identity and then links the resolution to it.

## Pricing Schedules

Pricing Schedules are separate durable records for future:

- standard schedules;
- contract pricing;
- promotional pricing;
- customer overrides;
- priority and effective periods;
- catalog-product schedule items.

Sprint 12 does not calculate prices. Billing will later select applicable schedules using account configuration, contracts, promotions, customer overrides, tax rules, and authorized adjustments.

## Billing Review

Acceptance creates a pending Billing Review. Approval freezes Product Resolution records so Billing receives a stable product set. Sprint 12 preserves the existing Billing engine and does not generate intake-driven invoices.

ADR-004 defines the approved future post-QC application-event and transactional-outbox handoff.

## Security and evidence

Catalog creation, Product Resolution, pricing administration, and Billing Review require authenticated server sessions and role authorization. Mutations record immutable audit evidence; lifecycle progress is appended separately to Clinical Communications.

## Verified

Sprint 12 integration coverage verifies:

- deterministic SKU assignment;
- category, restoration type, subtype, material, department, accounting category, and quantity mapping;
- catalog creation through the shared boundary;
- no customer pricing in Product Catalog columns, API input, or Product Resolution output;
- Pricing Schedule separation;
- product freezing after Billing Review approval;
- tenant isolation, authorization, audit, communications, and browser workflows.

Evidence: Sprint 12 Validation run `30407654085` on implementation head `d08490f545b3abb34af98b5845ec157d3c898b6e`.

## Deferred

- Pricing Schedule calculation and conflict resolution;
- contract, promotion, and customer-override eligibility;
- customer-price approval workflows;
- post-QC Billing command and transactional outbox;
- invoice-line creation from frozen product identities;
- invoice/shipment document bundling and statement inclusion.
