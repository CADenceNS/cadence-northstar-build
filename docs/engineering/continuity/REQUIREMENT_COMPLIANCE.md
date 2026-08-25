# Sprint 25 Requirement Compliance

## Supplemental End-to-End Dental Lab CRM operational-chain requirement

The owner-provided operational chain is preserved in full in
`END_TO_END_DENTAL_LAB_CRM_OPERATIONAL_CHAIN_REQUIREMENTS.md`. It is permanent future scope,
not completion evidence: Logistics Intake → Doctor Prescription → Product Selection → Case
Product → Production → Accounting & Receivables → Reconciliation, with Clinic Supply parallel.
Its required authoritative lineage is Practice/Doctor → Prescription → Case → Case Product
Line(s) → Production → QC → Shipment → Invoice Line(s) → Invoice → Statement → Payment /
Reconciliation. Implementation must preserve separate but linked Logistics, Inventory, Supply,
and Commercial domains; immutable historical records; tenant isolation; and auditability.

This capture does not authorize PP-1B, PP-1C, Logistics, carrier, Production/MES, Clinic Supply,
or accounting implementation. It does not broaden PP-1A-F6 source or change Design Studio.

## VIS-2C-F2 supplemental Product & Pricing / Case Configuration requirement

The owner-approved supplemental requirement is preserved in full, verbatim, at
PRODUCT_PRICING_CASE_CONFIGURATION_REQUIREMENTS.md, including the complete initial
catalog for FIX, REM, IMP, ORT, SLP, DIA, SPL, and AUX. It is additive to every previously
approved NorthStar CRM, laboratory operations, commercial-platform, v4.2-derived shell,
and Design Studio requirement.

This is a documentation/reconciliation record, not an implementation claim. The current
repository has a Product Catalog foundation, auto product resolution, and pricing-schedule
administration, but does not yet satisfy the complete tenant-owned Product & Pricing /
Case Configuration contract.

### Required eight-part classification

| Classification | Status | Evidence boundary |
|---|---|---|
| PRODUCT_CATALOG | PARTIAL | Tenant-scoped catalog foundation and create/auto-resolution exist; full catalog administration, lifecycle/archive behavior, and complete owner catalog are not complete. |
| PRICING_ENGINE | NOT STARTED | Pricing schedule records exist, but complete price calculation, bases, discounts, tax/fees, Rush pricing, and totals do not. |
| MULTI_PRODUCT_CASE_STACKING | PARTIAL | Multiple prescription/resolution entries exist; independent compatible line-item stacking and committed totals/snapshots do not. |
| CATEGORY_FILTERING | NOT STARTED | No complete server-enforced category/product eligibility contract exists. |
| ARCH_TOOTH_CONFIGURATION | PARTIAL | Arches/tooth numbers are carried by existing prescription payloads; dynamic product-specific configuration and validation are incomplete. |
| BUSINESS_DAY_TAT_ENGINE | PARTIAL | Weekend exclusion and basic 10/14-day helpers exist; tenant closures, multi-product rules, and protected overrides are incomplete. |
| PRICE_VERSIONING | NOT STARTED | No complete effective-dated price-book and historical snapshot contract exists. |
| CASE_TO_BILLING_PRODUCT_LINEAGE | PARTIAL | Product resolution/Billing Review evidence exists; authoritative priced case line items and downstream lineage are incomplete. |

The complete attachment requirements remain authoritative; no requirement is removed or
collapsed into a dropdown-only interpretation. No Product & Pricing code is authorized by
VIS-2C-F2 unless NEXT_ACTION.md explicitly changes.

## VIS-2C merged-main certification overlay

PR #41 is **OWNER APPROVED / CERTIFIED / MERGED**. The owner-approved product source head
is `fbddd1e557ede27a2e7e51ebba0b314a2a32d284`; the later
`bd897fccd808260dc6f91f3e0a977219ea6c442b` commit is documentation/continuity-only. Merge
commit: `bb50dfc8dc344b4e2cf173620c79bc342754c85f`; resulting tree:
`435117dc1bde03d0075dc1d93f9a7eaee19edcc1`.

Merged-main evidence: CI #638 PASS; Runtime #403 PASS; Sprint #297 PASS; Runtime and
Sprint Playwright 51/51; production builds, API health, migrations 0001–0010, authentication,
CSRF, tenant isolation, Platform Admin boundary, entitlements/seats, Design Studio access,
and Intake Administration passed. No private dental corpus was run and Design Studio
geometry was unchanged.

The next authorized action is PP-1A — Product Catalog, Pricing Foundation & Case Product
Line-Item Architecture, using the preserved Product & Pricing requirement file. PP-1A is not
started in VIS-2C.

## PP-1A-F7 future-planned scope record

Dynamic Pricing Engine and Labor Efficiency Scoring are recorded as PLANNED only. Dynamic
Pricing may later provide advisory cost, margin, rush, and market guidance, but must not alter
authoritative tenant Product Price Version billing records without explicit approval. Labor
Efficiency Scoring is future technician validation and operational analytics scope; it is not
implemented by PP-1A-F7.

## Authority and source identity

The complete line-by-line ledger is `docs/design-studio/SPRINT_25_COMPLIANCE_MATRIX.json`:

- schema: 3
- requirements: 712 unique IDs across 27 phases
- preserved specification identity: `Pasted text(10).txt`, SHA-256 `a72e78d89d3a5423b83149b7f41ce4b07abe072fba88c1a8a5d4ea6a70742fd2`
- audit baseline: `72add66b8479f417ef1331a12f87990149d907b6`, tree `67657872fa82970364ac61626172f8976741d403`
- matrix result recorded during PR #27: 709 `VERIFIED_COMPLETE`, 0 `PARTIALLY_IMPLEMENTED`, 0 `MISSING`, 3 `NOT_APPLICABLE_WITH_JUSTIFICATION`

The original source file itself is not in git; the matrix preserves its identity and all 712 requirement texts. This document is the post-merge reconciliation overlay and supersedes a matrix status whenever exact merged behavior disproves it.

## Reconciliation counts

| Audited state | VERIFIED_COMPLETE | PARTIALLY_IMPLEMENTED | MISSING | NOT_APPLICABLE_WITH_JUSTIFICATION | Meaning |
|---|---:|---:|---:|---:|---|
| Merged PR #27 / current `main` | 703 | 4 | 2 | 3 | Six lock/margin claims were invalidated by a real-geometry reproduction. |
| PR #28 corrective candidate | 709 | 0 | 0 | 3 | Implementation, direct deterministic/browser regressions, exact-head public workflows, and the final private-corpus gate are complete; architectural acceptance remains required. |

The three N/A rows are approval-override subrequirements. Hard corruption and hard QC failures are intentionally non-overridable; fabricating an override path would weaken fail-closed governance.

## Corrective overlay

| Requirement | Merged-main finding | Corrective implementation and evidence | Candidate status |
|---|---|---|---|
| `S25-P05-R018` — margin remains locked unless explicitly unlocked through the margin workflow | Proximal correction could move margin-ring vertices without consulting `locks.margin`. | `optimizeProximalContact` excludes the `margin` region; the tilted-axis test snapshots and exactly compares all margin vertices. | VERIFIED_COMPLETE |
| `S25-P05-R019` — no crown editing command may accidentally move the approved margin | Violated by `crown.contact-optimize`. | Same domain restriction plus registry reconciliation. | VERIFIED_COMPLETE |
| `S25-P12-R010` — automated optimization preserves locked regions | Joint optimization called the proximal tool with only side-lock state and could move a locked margin. | Proximal support is non-margin by construction, so both direct and joint paths preserve it. | VERIFIED_COMPLETE |
| `S25-P12-R013` — do not silently violate a lock | The optimizer reported `converged` after silently moving 32/48 margin vertices. | Exact vertex equality is now a required regression assertion. | VERIFIED_COMPLETE |
| `S25-P16-R006` — margin preservation in joint optimization | Missing in the final merged proximal domain. | Direct and joint contact correction share the non-margin edit domain. A feasible tilted-axis case proves convergence/contact/occlusion pass; the original infeasible geometry proves `best-effort`, explicit constraint violation, hard QC failure, valid topology, and no margin/intaglio/preparation movement. | VERIFIED_COMPLETE |
| `S25-P27-R032` — confirm no approved margin was silently changed | The old test checked intaglio and preparation, not the crown margin. | Deterministic feasible and infeasible cases snapshot `marginOuterVertexIds` and perform exact post-optimization comparisons. Browser coverage proves the infeasible case becomes `QC_FAILED` with approval/export disabled. The invariant fails on the pre-fix algorithm and passes on PR #28. | VERIFIED_COMPLETE |

## Phase coverage

| Phase | Category | Requirements | Candidate result | Primary implementation / deterministic evidence |
|---:|---|---:|---|---|
| 1 | Restoration Project Model | 32 | 32 verified | `restoration-types/state/commands.ts`; persistence/history tests |
| 2 | Proprietary CADence Morphology | 58 | 58 verified | `morphology-core.ts`, `crown-geometry.ts`; generation/golden/sculpt tests |
| 3 | Automatic Crown Proposal | 33 | 33 verified | `crown-engine/geometry/morphology-core.ts`; generation/golden tests |
| 4 | Pre-op / Reference Adaptation | 13 | 13 verified | `crown-geometry.ts`, `CrownWorkspace.tsx`; generation/material-history tests |
| 5 | Cervical & Emergence Design | 19 | 19 verified | `crown-geometry.ts`; generation/sculpt plus corrected margin regression |
| 6 | Intaglio & Cement Space | 24 | 24 verified | `crown-geometry/analysis/morphology-core.ts`; generation/QC/failure tests |
| 7 | Dynamic Proximal Contact | 22 | 22 verified | `crown-analysis/overlays.ts`; QC and failure tests |
| 8 | Dynamic Occlusion | 20 | 20 verified | `crown-analysis/overlays.ts`; QC and failure tests |
| 9 | Anatomy Editing | 31 | 31 verified | `crown-anatomy/geometry.ts`; 25-operation anatomy suite |
| 10 | Global Crown Morphing | 26 | 26 verified | `crown-geometry.ts`; generation/sculpt lock tests |
| 11 | Local Sculpting | 34 | 34 verified | `crown-geometry.ts`; all 17 sculpt modes, masks, falloff, symmetry |
| 12 | Contact & Occlusion Locks | 13 | 13 verified | locks in restoration/crown runtime; corrected margin regression, command tests |
| 13 | Minimum Thickness | 25 | 25 verified | `crown-analysis/overlays/qc.ts`; QC/failure tests |
| 14 | Governed Materials | 18 | 18 verified | `morphology-core/restoration-types/crown-qc.ts`; seven direct profile tests |
| 15 | Over/Under-contour | 14 | 14 verified | `crown-analysis/overlays.ts`; material-history/QC tests |
| 16 | Occlusal & Proximal Optimization | 15 | 15 verified | `crown-analysis.ts`; convergence, satisfied-constraint, large-correction, lock, and corrected margin tests |
| 17 | Crown QC | 28 | 28 verified | `crown-qc/analysis/export.ts`; QC and failure corpus |
| 18 | Restoration History | 21 | 21 verified | `restoration-state/commands.ts`; checkpoint/branch/persistence tests |
| 19 | Final Approval | 13 | 10 verified, 3 N/A | guarded commands/state; command and failure tests |
| 20 | Manufacturing Export | 35 | 35 verified | `crown-export/commands.ts`; four-format and failure tests |
| 21 | Round-trip Validation | 14 | 14 verified | `crown-export.ts`; deterministic four-format re-import tests |
| 22 | Golden Crown Corpus | 27 | 27 verified | golden fixtures/corpus, generation, failure tests |
| 23 | Technician E2E | 28 | 28 verified | `CrownWorkspace.tsx`; anterior/posterior Playwright workflows |
| 24 | Failure Corpus | 17 | 17 verified | 15-case required corpus plus input/QC rejection tests |
| 25 | Performance | 21 | 21 verified | measured small/medium/high-density/multi-crown and browser responsiveness |
| 26 | Tool Coverage Registry | 18 | 18 verified | crown/universal registries and compliance/failure tests |
| 27 | Exact-head Certification | 93 | public and private final gate passed; architecture pending | `2f8e7c4`, tree `03f5b44`: 421/421 deterministic, 47/47 Playwright, CI/Runtime/Sprint green; private integrity 23/23, core 99/99, corrective invariants 3/3 |

## Evidence boundary

- Supplemental PR #28 audit verified all 143 crown tests across 11 suites. The aggregate isolated run was 142/143 only because its temporary copy initially omitted repository evidence paths; the three compliance tests passed after those referenced files were restored. High-density evidence: 3,842 vertices / 7,680 triangles; watertight; zero self-intersections; maximum four-format round-trip deviation `4.800035299255723e-7 mm`.
- Official product-certified head `2f8e7c4`, tree `03f5b44`, retained frozen install, strict TypeScript, all builds, 421/421 deterministic tests across 41 suites, and 47/47 Playwright tests. CI `31850602483`, Runtime `31850602478`, and Sprint `31850602487` passed.
- The protected corpus v0.3 was mounted only in a restricted local harness and independently verified against `2f8e7c4`: archive SHA-256 `f3f7ffe54c9644939b103fe3ee0bc99000413c32fc65212ab838d595bde352cb`, integrity 23/23, confirmed owner attestation, registration 91/91, preparation 4/4, crown robustness 4/4, and supplemental corrective invariants 3/3.
- Private margin evidence checked 24 vertices at `0 mm` maximum displacement; intaglio evidence checked 145 vertices at `0 mm`. Preparation, adjacent, antagonist, and corpus-source geometry remained immutable. Controlled contacts reached governed pass with valid thickness/topology; infeasible geometry remained `constraint-conflict` / `QC_FAILED`, with approval and release blocked.
- Binary STL, ASCII STL, OBJ, and PLY re-imported successfully at maximum surface deviation `8.738665739279973e-7 mm` under the unchanged `0.001 mm` tolerance. Save/reopen, auto-save, recovery, protected locks, contact/QC state, and lineage passed. The privacy sweep found no source copy in git, reports, or production build output.
- No STL, OBJ, or PLY source geometry is tracked in git.

## VIS-2C-R1 remote reconciliation

Remote publication recovery preserves the owner-approved VIS-2C source. Product-certified head:
`fbddd1e557ede27a2e7e51ebba0b314a2a32d284`; remote merge head:
`bb50dfc8dc344b4e2cf173620c79bc342754c85f`; verified remote `main`:
`0a97ac83d860f264dcd3248134b20ce541140031`, tree `72c1abe673a3663ec2e446b83da6407aa984f078`.
Local/remote product-source equivalence is PASS. This is continuity reconciliation only; Product & Pricing
requirements remain preserved and unimplemented.

## PP-1A-F9 final certification overlay

PR #42 is **OWNER APPROVED / CERTIFIED / MERGED**. Approved product head/tree:
`35f97b54cd9480f052f3f1606d538b4fee2a5a75` /
`7ce5859d9bd746825ac0e4374a5ae313f15f2907`; merge/main:
`396b2837176bcc86187457e3403a0f91b99f8d40` with the same tree. CI #672, Runtime
#437, Sprint #331, and Runtime/Sprint Playwright 54/54 passed. Owner visual
approval covers Patient Management, Case Intake identity, Product & Pricing
visibility, and the approved shell; Design Studio is unchanged. The PP-1B
handoff is future-only and is preserved in `PP-1A_F9_FINAL_CERTIFICATION.md`.
