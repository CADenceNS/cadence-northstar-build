# ADR-006 — Tax Determination Is Separate from Billing

## Status
Accepted for architecture; implementation deferred.

## Decision
NorthStar will implement Tax as an independent domain that owns jurisdiction resolution, historical rate versions, exemption decisions, immutable determinations, and reports. Billing supplies taxable bases and owns invoice totals. Billing references a finalized determination; it does not calculate rates internally. Product Catalog stores tax-category identity only and contains no jurisdictional rates.

## Consequences
Tax providers are adapters behind an internal port. Historical invoices remain reproducible. Tax corrections use linked replacement/reversal determinations. Additional repositories and application commands are required before implementation.