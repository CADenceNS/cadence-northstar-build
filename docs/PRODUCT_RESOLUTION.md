# Product Resolution

## Purpose

Product Resolution converts clinically described restorations in a completed Digital Prescription into billable product identities. It identifies what was ordered; it does not calculate what the customer pays.

## Architectural boundary

The permanent flow is:

Digital Intake → Product Resolution → Billing command → Pricing resolution → Invoice

Digital Intake owns submission and prescription data. Product Resolution owns product identification. Billing owns pricing, taxes, invoice generation, payments, and statements.

## Inputs

Product Resolution consumes:

- the stored Digital Prescription;
- restoration category, type and subtype;
- material;
- quantity, units, tooth positions or arches;
- the tenant Product Catalog.

## Outputs

Each resolution records:

- Product SKU;
- product category;
- restoration type;
- restoration subtype;
- material;
- quantity;
- production department;
- accounting category;
- Product Catalog reference when a matching catalog item exists;
- authenticated resolver and timestamp.

Submission and Doctor-facing responses exclude internal cost, outsource cost, default price, promotional price, contract price, and customer-specific price.

## Product Catalog

The Product Catalog is the tenant master for stable product identity and operational classification. It stores SKU, product name, restoration category and subtype, material, department, accounting category, tax classification, turnaround category, active state, and internal operational cost metadata.

Catalog identity is independent from customer Pricing Schedules. Customer prices must not be embedded into the resolution record.

## Matching behavior

The foundation attempts an active catalog match using restoration subtype and material. When no catalog product exists, it creates a deterministic provisional catalog identity for the tenant and records the resulting SKU. Future catalog-governance work may require administrative approval before provisional products become generally available.

## Billing Review

Acceptance creates a pending Billing Review. Authorized staff validate the resolved product set. Approval freezes the resolved products so downstream Billing receives a stable order description.

Sprint 12A establishes the dedicated boundary but does not move price calculations into Digital Intake. Automatic invoice generation remains owned by Billing and requires a future Billing command that consumes the approved, frozen product set.

## Pricing Schedule foundation

Pricing Schedules are separate durable records supporting future:

- standard schedules;
- contract pricing;
- promotional pricing;
- customer overrides;
- schedule priority and effective dates;
- catalog-product schedule items.

No customer-price calculation is implemented in Sprint 12A. Billing will later resolve prices from applicable schedules, account configuration, promotions, contracts, and tax rules.

## Audit and communications

Product resolution and Billing Review transitions record immutable audit events and append operational communication events. The communication content records operational progress without copying security-audit evidence.

## Deferred

- Pricing Schedule calculation and conflict resolution;
- contract and promotion eligibility rules;
- customer-specific price approval;
- post-QC Billing command orchestration;
- invoice-line creation from frozen resolution records;
- invoice printing and shipment bundling;
- statement inclusion triggered directly from intake.
