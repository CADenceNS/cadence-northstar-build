# End-to-End Dental Lab CRM Operational Chain

## Owner-provided supplemental scope and authority

This is a permanent owner-provided NorthStar requirement capture. It is architecture and
roadmap scope only; it does not claim that any of the capabilities below are implemented.
It supplements, and does not replace, the owner-approved Product & Pricing / Case
Configuration requirement, the approved v4.2-derived NorthStar shell, current Design
Studio, tenant/security boundaries, or commercial-platform requirements.

`NEXT_ACTION.md` remains the only implementation authority. In particular, this record
does not authorize Logistics, PP-1B, PP-1C, Production/MES, Clinic Supply, carrier, or
accounting-ledger implementation.

## Connected operational architecture

NorthStar must remain one connected operational system, not disconnected CRUD modules:

```text
LOGISTICS INTAKE
  → DOCTOR PRESCRIPTION
  → PRODUCT SELECTION
  → CASE PRODUCT
  → PRODUCTION
  → ACCOUNTING & RECEIVABLES
  → RECONCILIATION
```

`CLINIC SUPPLY PROCESS` is a parallel workflow. The authoritative lineage is:

```text
PRACTICE / DOCTOR
  → PRESCRIPTION
  → CASE
  → CASE PRODUCT LINE(S)
  → PRODUCTION
  → QC
  → SHIPMENT
  → INVOICE LINE(S)
  → INVOICE
  → STATEMENT
  → PAYMENT / RECONCILIATION
```

Logistics, Inventory, Supply, and Commercial remain separate but linked domains. Tenant
ownership, authorization, auditability, immutable historical records, and server-authoritative
relationships remain permanent requirements at every stage.

## 1. Logistics / inbound SCM — planned

Future NorthStar Logistics Intake must support clinic pickup requests from portal, email,
or manual sources; inbound carrier and tracking state; local-driver routing; UPS, FedEx,
and future carrier adapters; inbound shipping labels; physical container counts; barcode
receipt at the laboratory; pickup/arrival notifications; physical-impression photo uploads;
and explicit physical, digital, and hybrid intake relationships. Carrier integrations are not
authorized by this record.

## 2. Case type and immutable parent lineage — planned

Case Intake must distinguish `NEW`, `REMAKE`, and `REPAIR`. A remake or repair must retain
immutable parent-case lineage and must never overwrite or destroy the original case. External
display-number prefixes/sequences are configurable, but the architecture must support distinct
case-type prefixes/sequences.

## 3. Doctor prescription — planned integration authority

Prescription data must drive the requested restoration, tenant Product Catalog filtering,
arch, teeth, units, required case information, supporting files, and physical/digital/hybrid
format. The tenant Product Catalog remains the authoritative product source.

## 4. PP-1B Case Builder integration — planned

The required flow is:

```text
Doctor prescription
  → restoration category
  → eligible tenant products
  → arch/tooth/unit mapping
  → compatible stacked products
  → pricing
  → turnaround
  → preview
  → saved Case Product Lines
```

No duplicate, independent case-product list is permitted. Product selection must resolve into
the same authoritative Case Product Line records that carry configuration, pricing, turnaround,
and downstream lineage.

## 5. Remake / repair reason codes — planned

Future tenants must be able to configure structured remake/repair reason codes, including
clinical/customer-originated, laboratory-originated, and other/admin groupings. Supplied
examples may seed future terminology but must not be hard-coded globally without owner
approval. Reasons must support QC, analytics, billing responsibility, and audit history.

## 6. Case Product to manufacturing routing — planned

Saved Case Product configuration must be usable by future production routing for digital,
analog, and hybrid workflows; workstation dependencies; target-station dates; production
release; and capacity planning. Routing must remain tenant/product-specific and extensible;
the platform must not hard-code a single route for every product.

## 7. Production / MES — planned

Future Production scope includes station queues; barcode check-in/check-out; technician
identity; labor/time history; governed case-status transitions; CAD, mill, bench, and QC
stages where applicable; attachments, screenshots, and logs; priority handling; remake/repair
visibility; production history; and final QC release.

## 8. PP-1C billing lineage — planned

The required financial lineage is:

```text
PRODUCT → CASE PRODUCT LINE → PRODUCTION CASE → INVOICE LINE → INVOICE → STATEMENT
```

Billing staff must not manually recreate catalog charges already captured on Case Product
Lines. Future support includes practice/customer-specific, contract, volume/special pricing;
authorized discounts; remake/repair financial responsibility; warranty/no-charge lines;
credit memos; adjustments; and a complete audit history. Financial-responsibility percentages
must be tenant-configurable, never globally hard-coded.

## 9. Invoice and shipment architecture — planned

Invoice and Shipment are separate, linked entities. Shipment must not be hard-coupled to
invoice finalization: authorized users may create a shipment, create an invoice, or finalize
both together when appropriate. Preserve `CASE ↔ SHIPMENT` and
`CASE PRODUCT LINE ↔ INVOICE LINE` lineage. Future shipment support includes carrier,
service, tracking, labels, local delivery, consolidated shipment, and partial/multiple
shipments.

## 10. Accounting ledger — planned

Future accounting must provide auditable journal/subledger behavior for Accounts Receivable,
revenue, payments, credits, write-offs, and cash/application. Journal logic must not be
hard-coded into UI buttons and must remain extensible for future accounting integrations.

## 11. Statements and reconciliation — planned

Statements must be derived from invoices, payments, and adjustments—not manually overwritten.
Future scope includes open and partially paid invoices; Current/30/60/90+ aging; ACH/card/check
where implemented; direct invoice allocation; FIFO assistance where appropriate; credit memos;
write-offs; payment reconciliation; and statement status/history.

## 12. Credit control — planned tenant policy

Tenants must be able to configure warning thresholds, credit hold, case-creation restriction,
supervisor override, exceptions, and notifications. The platform must not globally hard-code
“60 days past due automatically blocks all new cases”; a laboratory may configure such a
policy, but it is not universal NorthStar behavior.

## 13. Clinic Supply Process — planned parallel workflow

Clinic Supplies must remain independent from patient Case workflows while sharing appropriate
customer/practice identity, inventory, logistics, shipping, and accounting relationships. Its
future flow is:

```text
SUPPLY REQUEST → INVENTORY ALLOCATION / PICKING → DISPATCH → DELIVERY
```

It may use an identity such as `S-[YEAR]-[SEQUENCE]` or the repository-standard equivalent.
An operational supply shipment may be consolidated with an outbound case shipment, but the
underlying supply and patient-case records must remain distinct.

## Current-task protection

This document does not modify PP-1A-F6 Product & Pricing source, tests, migrations, Render
configuration, PR #42 state, the approved NorthStar shell, or Design Studio. It does not begin
PP-1B, PP-1C, Logistics, Production/MES, Clinic Supply, carrier integration, or accounting
implementation.
