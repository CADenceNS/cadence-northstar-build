# Sprint 08 — Billing & Financial Engine

## Status

Implementation complete; validation pending on the Sprint 8 pull request.

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

- [ ] Frozen-lockfile installation passes.
- [ ] TypeScript validation passes without contract weakening.
- [ ] Production build passes.
- [ ] API gateway, upstream API, and frontend start successfully.
- [ ] Delivered shipments automatically generate one invoice.
- [ ] Multi-case shipments create multi-line invoices.
- [ ] Taxes respect practice tax-exempt status.
- [ ] Discounts, credits, fees, terms, and totals recalculate correctly.
- [ ] Payments cannot exceed the outstanding balance.
- [ ] AR aging and monthly statements pass.
- [ ] Dashboard financial metrics update.
- [ ] Authentication and Sprint 3–7 browser regressions pass.
- [ ] Sprint 8 Playwright lifecycle passes.

## Sprint 9 persistence boundary

`FinancialRepository` separates financial domain behavior from persistence. Sprint 9 should implement a PostgreSQL adapter with transactional invoice, invoice-line, adjustment, payment, statement, and audit-event tables; unique invoice and shipment constraints; decimal monetary columns; tenant/practice indexes; immutable payment records; and migration/backfill tooling.

## Out of scope

- PostgreSQL persistence.
- Payment-processor integration.
- ACH or card settlement.
- PDF statement and invoice object storage.
- General ledger and bank reconciliation.
- Production identity-provider changes.
