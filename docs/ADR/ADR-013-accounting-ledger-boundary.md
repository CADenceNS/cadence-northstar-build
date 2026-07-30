# ADR-013 — Accounting Ledger Separate from Billing

## Status
Accepted for architecture; implementation deferred.

## Decision
Billing remains the operational source for invoices, credits, payments and statements. The Accounting domain will own charts of accounts, double-entry journals, periods, fiscal years, revenue recognition, deferred revenue, AP, control accounts, closing and financial reporting. Billing events are posted through versioned accounting commands and posting rules.

## Consequences
Posted journals are immutable and corrected by reversal/replacement. Tenant laboratory books remain separate from NorthStar Platform subscription books. Accounting cannot change invoice workflow or pricing.