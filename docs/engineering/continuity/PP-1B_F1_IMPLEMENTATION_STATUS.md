# PP-1B-F1 Case Journey Foundation — In Progress

This branch implements only the PP-1B-F1 persistent Case Journey foundation.

| Requirement | Status |
| --- | --- |
| NEW / REMAKE / REPAIR / CONTINUATION relational lineage | PARTIAL — implemented in the F1 branch; awaiting Draft PR validation and owner review. |
| Tenant reason, continuation stage, and billing-policy catalogs | PARTIAL — implemented as tenant-scoped controlled catalogs; no billing execution. |
| Remake/repair responsibility decision and exact percentage rule | PARTIAL — implemented; no automatic fault inference. |
| Case Intake relationship selection, preview, and history | PARTIAL — implemented; full Case Builder remains F2. |
| Product Catalog case configuration / Case Product Lines | NOT STARTED — reserved for PP-1B-F2. |
| Invoice creation, price calculation, AR | NOT STARTED — reserved for PP-1C. |
| Logistics, MES, Clinic Supply, Design Studio | NOT STARTED / UNCHANGED. |

The Case Journey model is intentionally a foundation: it does not duplicate Product
Catalog selection, create invoices, assign production routes, or infer financial
responsibility. PR status and owner preview approval remain external evidence.

## F1A owner-review correction scope

- Direct Remake, Repair, and Continue actions bind the selected source case by its
  persistent case ID, resolve the existing root server-side, preserve the source
  patient/practice/doctor, and present that locked relationship before creation. The
  manual relationship workflow retains its validated parent picker.
- Remake and Repair begin with no responsibility or allocation. Reason categories
  never assign fault. An authorized user explicitly selects responsibility and a
  clinic allocation; the laboratory allocation is the exact remaining percentage and
  the server still requires an exact 100.00% total.
- Preview is the non-persistent confirmation boundary. It shows lineage, patient,
  doctor, practice, reason/responsibility/allocation for Remake/Repair, and
  continuation stage/state/tenant policy for Continuation.

## Recorded future scope — not implemented by F1 or F1A

- **PP-1B-F2 Case Number:** tenant-configurable, immutable, human-readable number
  with relationship, deterministic doctor-derived code, date, and concurrency-safe
  sequence; relational IDs remain authoritative and doctor-name changes do not alter
  issued case numbers.
- **Patient and Doctor identity:** patient reference remains optional; patients own
  many linked cases. New doctors require an automatic stable tenant-owned account
  number and future structured license, controlled specialty/type, professional
  profile, and documented tax-exemption evidence fields.
- **PP-1C billing lineage:** the authoritative case number must flow through
  Production, QC, Shipment, Invoice Line, Invoice, Statement, and Payment /
  Reconciliation. Product value remains distinct from warranty/remake responsibility
  adjustments; no invoice or statement automation is introduced here.


## Final F1 certification

PP-1B-F1 is OWNER APPROVED / CERTIFIED / MERGED via PR #44. Owner-approved product
head/tree: b55348ea8d0822ff1e23d40a97d6e54176e7d760 /
d7425b1fee5ee2aee374b68727c913f0177d0a94. Merge commit:
c38d404ee87131fa49166b77d9f9e24c0f1c8cfa. CI #692, Runtime #457, Sprint #351,
and Playwright 55/55 passed; owner visual approval is PASS.

F2A is not implemented by this commit. Its complete authorized scope, including the
single Product Catalog authority, cascading builder, configuration metadata, stacked
Case Product Lines, arch/tooth semantics, TAT, hold/release, cancellation, future Case
Number, Doctor Account, tax profile, and PP-1C billing lineage, is recorded in
PP-1B_F2A_AUTHORIZED_HANDOFF.md.
