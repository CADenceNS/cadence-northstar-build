# Tax Engine & Tax Exemption Architecture

## Purpose

Define provider-neutral multi-state Sales and Use Tax capabilities for laboratory tenants. Billing consumes Tax determinations; tax logic does not enter Digital Intake, Scanner Providers, Product Catalog, Pricing Schedules or Communications.

## Ownership

The Tax Engine owns jurisdiction resolution, historical rate versions, tax-category rules, exemption decisions, immutable determinations, reporting exports and provider adapters. Billing owns invoice lifecycle, taxable bases, credits, adjustments and totals. The subscribing laboratory owns tenant tax configuration; its Doctor Practices are customer accounts whose exemption evidence may affect Billing.

## Jurisdiction model

```text
Country
└─ State
   └─ County
      └─ City / District / Special District
```

`tax_jurisdiction` has stable identity, type, code, name, parent, authority, timezone, effective status and optional geometry/provider identifiers. An address can resolve to multiple concurrent jurisdictions. Resolution records source, confidence and manual-review status.

## Historical rate versioning

Activated `tax_rate_version` records are immutable and contain jurisdiction, tax category, component, rate, effective interval, source, approval, supersession and actor metadata. Historical invoices always retain and reference the exact effective rate versions and jurisdiction resolution used at the taxable event date. Current rates never overwrite prior determinations.

## Tax categories and tenant policy

Products reference stable tax/accounting categories rather than rates. Tenant tax settings may map Product Catalog accounting categories, shipping, handling, credits and services to jurisdiction rules. Legal classification and nexus policy require professional review and explicit effective versions.

## Determination command

`DetermineTax` receives tenant/customer account, invoice/case references, ship-from/ship-to/bill-to addresses, dates, line IDs, quantities, taxable bases, discounts, categories, exemption context, currency and idempotency key.

It returns determination/version IDs, resolved jurisdictions, rate-version IDs, line taxable bases, tax amounts, exemption decisions, rounding, total tax and warnings/manual-review state. Finalized determinations are immutable. Corrections create linked reversal or replacement determinations.

## Tax Exemption Management

A customer-level exemption profile belongs to one Practice/account within one laboratory tenant. Proposed records:

- `customer_tax_profile`;
- `tax_exemption_certificate`;
- `tax_exemption_certificate_version`;
- `tax_certificate_jurisdiction`;
- `tax_certificate_category_scope`;
- `tax_certificate_verification`;
- `tax_certificate_reminder`;
- `tax_exemption_decision`.

Certificate data includes certificate number/type, effective and expiration dates, status, ObjectStorage document ID, jurisdiction/category scope, verification evidence, renewal schedule, supersession and audit metadata.

### Certificate lifecycle

```text
Uploaded → Pending Verification → Verified → Expiring → Expired
                         └→ Rejected
Verified ──authorized action──→ Revoked
```

### Billing behavior

1. Authorized invoice override with reason and approval.
2. Active verified certificate matching tenant, customer, jurisdiction, date and category: exemption applies and decision reference is stored.
3. Expired certificate: no exemption; tax applies or invoice enters configured manual review.
4. Revoked/rejected certificate: tax applies; prior historical determinations remain unchanged.
5. Jurisdiction/category mismatch: tax applies or manual review; certificate is not treated as valid evidence.
6. Pending or missing evidence: taxable default unless tenant policy requires review.

Billing stores the exemption decision and Tax determination references, not mutable certificate assumptions.

## Renewal and expiration

A tenant-configurable scheduler emits reminders before expiration to authorized laboratory staff and customer contacts. Reminder events are idempotent, auditable and contain metadata only, not certificate document content. Failed delivery enters an operational queue.

## Sales and Use Tax reporting

Tenant-scoped reports support filing period, jurisdiction, Practice/customer, category, invoice and determination filters. Exports include gross sales, exempt sales, taxable sales, collected tax, use tax, credits, adjustments, certificate references and reconciliation totals. Formats include CSV and a versioned provider-neutral JSON schema. Export actions are authorized and audited.

## External provider architecture

A stable `TaxProvider` port supports jurisdiction lookup, tax determination and optional certificate validation. Adapters translate provider identities and responses into NorthStar’s internal jurisdiction, rate-version and immutable determination models. Providers never become the source identity for NorthStar records, and historical determinations remain readable if a provider changes.

## Security and tenant isolation

- dedicated Tax administration and report permissions;
- tenant/customer authorization on every certificate and report;
- ObjectStorage safe metadata and authorized downloads;
- no Platform Owner certificate access without a support grant;
- reason and immutable audit for overrides, verification, revocation and export;
- tenant-scoped caches, provider credentials and idempotency keys;
- sensitive document retention and legal-hold policy.

## Deferred

Nexus determination, legal rule content, geocoding, provider selection, filing/remittance, certificate runtime, tax calculations and Billing integration remain deferred.