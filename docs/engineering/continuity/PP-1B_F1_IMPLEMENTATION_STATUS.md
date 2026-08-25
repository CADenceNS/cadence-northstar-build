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
