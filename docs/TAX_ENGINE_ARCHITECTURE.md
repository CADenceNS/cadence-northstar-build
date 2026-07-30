# Tax Engine & Tax Exemption Architecture

## Purpose

Define a multi-state Sales and Use Tax capability that Billing can consume without embedding tax logic in Digital Intake, Product Catalog, Pricing Schedules, Scanner Providers, or Communications.

## Ownership

The Tax Engine owns:

- jurisdiction hierarchy and address-to-jurisdiction resolution;
- historical tax-rate versions;
- taxable-category rules;
- exemption decisions;
- immutable tax determinations;
- Sales and Use Tax reporting exports;
- external provider adapters.

Billing owns invoice lifecycle, taxable amounts, credits, adjustments, and invoice totals. Billing requests a determination and stores the returned determination reference and totals.

## Jurisdiction model

```text
Country
  └─ State
      └─ County
          └─ City / District / Special District
```

A `tax_jurisdiction` has a stable ID, type, code, name, parent, authority, timezone, effective status, and optional geometry/provider identifiers. A postal address may resolve to multiple concurrent jurisdictions.

## Rate versioning

`tax_rate_version` is immutable after activation and includes:

- jurisdiction ID;
- tax category;
- rate component;
- effective-from and effective-to instants;
- source and source reference;
- approval status;
- superseded version reference;
- created/approved actor and timestamp.

Historical invoice recalculation always uses the rate versions effective at the taxable event date, never the currently active rate.

## Tax categories

Products reference a stable accounting/tax category, not a tax rate. Example categories include taxable restoration, exempt professional service, shipping, handling, credit, and non-taxable diagnostic service. The exact legal classification is tenant/jurisdiction configuration and requires tax-professional review.

## Determination command

`DetermineTax` input:

- tenant and account IDs;
- invoice/case references;
- ship-from, ship-to, and bill-to addresses;
- transaction and fulfillment dates;
- line identifiers, quantities, taxable bases, discounts, and tax categories;
- exemption context;
- currency;
- idempotency key.

Output:

- determination ID and version;
- resolved jurisdictions;
- applied rate-version IDs;
- line-level taxable bases and tax amounts;
- exemption decision references;
- rounding method;
- total tax;
- warnings or manual-review status.

The determination becomes immutable when an invoice is finalized. Corrections produce a reversal or replacement determination linked to the original.

## Tax Exemption Management

`tax_exemption_certificate` includes:

- tenant and customer account;
- jurisdiction scope;
- exemption type and certificate number;
- effective and expiration dates;
- verification status;
- ObjectStorage document ID;
- renewal-notice schedule;
- superseded certificate;
- approval and audit metadata.

Decision precedence:

1. Explicit invoice-level override by authorized Billing/Tax role
2. Active verified certificate matching jurisdiction and category
3. Account exemption status backed by a valid certificate
4. Taxable default
5. Manual review when evidence is incomplete or expired

Expired, revoked, pending, or jurisdiction-mismatched certificates do not suppress tax.

## Renewal reminders

A scheduler emits reminder events at configurable intervals before expiration. Notifications contain certificate metadata but not document contents. Failed reminders are retried idempotently and surfaced on an operational queue.

## Reporting

Sales and Use Tax reports support date, tenant, jurisdiction, customer, category, invoice, and filing-period filters. Exports include gross sales, exempt sales, taxable sales, collected tax, adjustments, credits, and determination references. Export formats should include CSV and a versioned provider-neutral JSON schema.

## External provider port

```ts
interface TaxProvider {
  resolveJurisdictions(address: PostalAddress): Promise<JurisdictionMatch>;
  determine(request: ProviderTaxRequest): Promise<ProviderTaxResponse>;
  validateCertificate?(request: CertificateValidationRequest): Promise<CertificateValidationResponse>;
}
```

Adapters translate provider responses into NorthStar’s immutable internal determination. Provider IDs never become the primary domain identity.

## Security

- Tax administration requires dedicated permissions.
- Certificate documents use ObjectStorage and authorized downloads; internal object keys are never exposed.
- Tax overrides require reason, approval, and immutable audit.
- Reports are tenant-scoped and export actions are audited.
- Platform support cannot inspect certificates without temporary audited tenant support scope.

## Deferred

- legal nexus determination;
- marketplace-facilitator logic;
- automated filing and remittance;
- provider selection;
- jurisdiction geocoding;
- production tax calculations.