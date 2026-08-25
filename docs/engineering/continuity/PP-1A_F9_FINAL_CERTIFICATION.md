# PP-1A-F9 Final Certification and PP-1B Handoff

**Recorded:** 2026-08-25  
**PR:** #42  
**Owner visual approval:** PASS

## Final PP-1A certification

PP-1A is **OWNER APPROVED / CERTIFIED / MERGED**. The approved product source was
`35f97b54cd9480f052f3f1606d538b4fee2a5a75` (tree
`7ce5859d9bd746825ac0e4374a5ae313f15f2907`). PR #42 merged normally as
`396b2837176bcc86187457e3403a0f91b99f8d40`; resulting `origin/main` is that same
merge commit and tree `7ce5859d9bd746825ac0e4374a5ae313f15f2907`.

Exact-head evidence: CI #672 PASS; Runtime #437 PASS; Sprint #331 PASS; Runtime
Playwright 54/54; Sprint Playwright 54/54. The merged tree preserves the complete
tenant catalog (FIX 27, REM 13, IMP 13, ORT 13, SLP 6, DIA 7, SPL 6, AUX 2),
tenant-owned lifecycle and family/category rules, editable configuration and
pricing basis, effective-dated immutable price versions, direct current-price
visibility, explicit unpriced state, stable case-product snapshots, migrations
through 0012, optional patient references, shared patient identity formatting,
tenant isolation, and authorization boundaries.

Owner-approved visual areas were Patient Management, Case Intake patient identity,
Product & Pricing Administration, actual priced/unpriced catalog visibility, and
the approved NorthStar shell. Design Studio remains unchanged. No PP-1B or PP-1C
implementation was included.

## PP-1B handoff — future scope only

PP-1B is the next authorized implementation phase. It must use the PP-1A tenant
Product Catalog as its only product authority and must not create a duplicate Case
Intake product list. The future flow is:

`Prescription → Case Relationship → Parent/Root Case → Reason or Continuation Stage → Responsibility/Billing Policy → Category → Eligible Tenant Product(s) → Arch/Teeth/Units → Compatible Product Stacking → Price → TAT → Preview → Case Product Lines`

Case relationships are **NEW**, **REMAKE**, **REPAIR**, and **CONTINUATION**.
Remake, repair, and continuation episodes link to a parent/root case and preserve
immutable lineage; continuation is not a disconnected new case. Tenant-defined
continuation stages and reasons must be supported.

Remake/repair reasons remain controlled and tenant-configurable across laboratory,
clinical/practice, and requested-change categories. A reason must not by itself
assign fault. Future responsibility records must preserve responsibility party,
clinic percentage or custom split, authorized user, timestamp, notes/evidence, and
parent/root lineage; lab responsibility is the corresponding balance.

Continuation billing is tenant-configurable (bill at final completion, by
milestone, every continuation, or hybrid). Product value remains authoritative;
responsibility is represented through explicit adjustments, never by rewriting a
product price to zero. Invoice and shipment remain separate linked entities, and
statements derive from invoice/payment/adjustment ledger state.

No PP-1B implementation, PP-1C implementation, Logistics/MES expansion, or Clinic
Supply implementation is authorized by this record.
