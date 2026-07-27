# Sprint 08 — Billing & Financial Engine

## Status

Complete and verified.

## Objective

Deliver an authenticated financial lifecycle integrated with delivered shipments, clinical cases, practices, doctors, patients, production, QC, and logistics.

## Scope

- Automatic invoice generation when a shipment is marked Delivered.
- Multiple clinical cases per invoice through multi-case shipments.
- Invoice lines, taxes, discounts, credits, fees, payment terms, and notes.
- Payment recording with method, reference, user attribution, and timestamp.
- Accounts-receivable aging buckets.
- Monthly practice statements.
- Dashboard invoiced, collected, outstanding, overdue, invoice-count, paid-count, and average-days-to-pay metrics.
- Financial API endpoints and authenticated React workspace.
- Repository interfaces with an in-memory implementation and PostgreSQL-ready boundary for Sprint 9.
- Playwright coverage through delivery, invoice generation, adjustment, payment, statement, aging, and dashboard updates.

## Acceptance gates

- [x] Frozen-lockfile installation passes.
- [x] TypeScript validation passes without contract weakening.
- [x] Production build passes.
- [x] API gateway, upstream API, and frontend start successfully.
- [x] Delivered shipments automatically generate one invoice.
- [x] Multi-case shipments create multi-line invoices.
- [x] Taxes respect practice tax-exempt status.
- [x] Discounts, credits, fees, terms, and totals recalculate correctly.
- [x] Payments cannot exceed the outstanding balance.
- [x] AR aging and monthly statements pass.
- [x] Dashboard financial metrics update.
- [x] Authentication and Sprint 3–7 browser regressions pass.
- [x] Sprint 8 Playwright lifecycle passes.

Verified in Sprint 08 Validation run `30237624951` and Runtime Validation run `30237624909`.

## Sprint 9 persistence boundary

`FinancialRepository` separates financial domain behavior from persistence. Sprint 9 should implement a PostgreSQL adapter with transactional invoice, invoice-line, adjustment, payment, statement, and audit-event tables; unique invoice and shipment constraints; decimal monetary columns; tenant/practice indexes; immutable payment records; and migration/backfill tooling.

## Out of scope

- PostgreSQL persistence.
- Payment-processor integration.
- ACH or card settlement.
- PDF statement and invoice object storage.
- General ledger and bank reconciliation.
- Production identity-provider changes.
