# Next Action

Last verified: 2026-08-21

## Supplemental permanent requirement captured

VIS-2C-F2 now includes the owner-approved Product & Pricing / Case Configuration foundation.
The full, verbatim requirement and complete initial FIX/REM/IMP/ORT/SLP/DIA/SPL/AUX
catalog are preserved in PRODUCT_PRICING_CASE_CONFIGURATION_REQUIREMENTS.md.
Current statuses are:

- PRODUCT_CATALOG=PARTIAL
- PRICING_ENGINE=NOT STARTED
- MULTI_PRODUCT_CASE_STACKING=PARTIAL
- CATEGORY_FILTERING=NOT STARTED
- ARCH_TOOTH_CONFIGURATION=PARTIAL
- BUSINESS_DAY_TAT_ENGINE=PARTIAL
- PRICE_VERSIONING=NOT STARTED
- CASE_TO_BILLING_PRODUCT_LINEAGE=PARTIAL

This is a permanent scope/reconciliation update only. It does not authorize Product &
Pricing implementation, replace any existing requirement, alter the approved UI or Design
Studio geometry, or authorize CF-1B/Sprint 26.

## VIS-2C final certification

VIS-2C is **OWNER APPROVED / CERTIFIED / MERGED** via PR #41. Owner-approved product
source head: `fbddd1e557ede27a2e7e51ebba0b314a2a32d284`; docs-only tail:
`bd897fccd808260dc6f91f3e0a977219ea6c442b`; merge `bb50dfc8dc344b4e2cf173620c79bc342754c85f`;
main/product-runtime tree `435117dc1bde03d0075dc1d93f9a7eaee19edcc1`.
CI #638, Runtime #403, and Sprint #297 passed; Runtime/Sprint Playwright 51/51.
Owner visual acceptance is PASS. The approved foundations are the v4.2-derived NorthStar
workspace and current CADence Design Studio. Future foundational UI changes are additive
only and require explicit owner approval.

## Current authority

The exact authorized next action is:

> **PP-1A — PRODUCT CATALOG, PRICING FOUNDATION & CASE PRODUCT LINE-ITEM ARCHITECTURE**

Recommended model: **GPT-5.6 Terra**.

PP-1A must use `PRODUCT_PRICING_CASE_CONFIGURATION_REQUIREMENTS.md` as its authoritative
owner requirement and is not started in this merge task. Do not begin CF-1B or Sprint 26.

VIS-1B is **CERTIFIED AND MERGED** via PR #38. Runtime head `0033ecc7363274821e81806fa6b71bfd4d2fe7cb`, tree `616a00d409cf98ff64255c8545efbcfc13a4d143`; merge commit `d2f4d3e01cfd25ec95104f8e71f7795a8e9de889`. CI #625, Runtime #390, and Sprint #284 passed; Runtime/Sprint Playwright 51/51. Production API start/health, PORT handling, external migrations 0001–0010, security/UAT, tenant isolation, Platform Admin boundary, NorthStar build, and Design Studio build passed. No deployment or DNS action occurred.

## Verified baseline

- Product-certified head: `0535e8c433226c167cca85ffefd83d50ee1d57db`
- Product tree: `2b72dce8956e940d93e6513567d19039c1609e8c`
- Merged-main commit: `e03f85144f31533e8785588c5cf1514a92184ab1`; merged-main tree: `e30b3b43f74f4b32cbe729ef8188aaa5d596fb6e`
- Restored CF-1A0 product head: `81dd130d369afaf431c479f28b72d74c054bbc50`; product tree: `91dae2d9d40571406b09a13d4640ecead77c33b1`
- PR #29: merged; CI, Runtime Validation, Sprint Validation, 421/421 deterministic, and 47/47 Playwright all passed
- PR #30: merged at `4cdd57090b031b5b71bc811f666710dd99451cec`; documentation/continuity only
- Expanded commercial roadmap: permanently stored
- Sprint 25: fully reconciled, certified, and merged
- No active Sprint 25 blocker remains
- CF-1A0: CERTIFIED AND MERGED via PR #32.
- CF-1A1: CERTIFIED AND MERGED via PR #33.
- VIS-1D: CERTIFIED AND MERGED via PR #39; merge `ff70baa3bfbde7a928ca6b708a1de4e9b593fd69`, product/runtime tree `828fd6477a64810e1d32996f6672c564a8f1569a`; CI #629, Runtime #394, Sprint #288 PASS, with 51/51 Playwright in Runtime and Sprint. `OWNER_PREVIEW_VISUAL_ACCEPTANCE = PENDING`.

## Continuity-state semantics

`LAST_REPOSITORY_HEAD_VERIFIED` is the `main` HEAD inspected before the current continuity update. It is not a self-referential invariant. If `main` is later ahead, compare the delta. A verified documentation-only delta may be reconciled without invalidating `PRODUCT_CERTIFIED_HEAD`.

## Explicit sequencing rule

PP-1A is the next authorized implementation action. Product & Pricing implementation is
not included in VIS-2C; no CF-1B or Sprint 26 work is authorized.

This continuity repair does not implement CF-1, Sprint 26, or any product feature. It does not rerun private-corpus certification.

## PP-1B-F1 active action

PP-1B-F1 Case Journey Foundation is now the bounded active Draft-PR action. It is
limited to persistent case lineage, tenant-controlled journey catalogs, explicit
responsibility decisions, and the progressive Case Intake foundation. PP-1B-F2 and
PP-1C remain unauthorized until owner approval.

VIS-2C-R1 confirms remote reconciliation: product-certified head `fbddd1e557ede27a2e7e51ebba0b314a2a32d284`,
remote merge `bb50dfc8dc344b4e2cf173620c79bc342754c85f`, and verified remote tip
`0a97ac83d860f264dcd3248134b20ce541140031` (tree `72c1abe673a3663ec2e446b83da6407aa984f078`).

## PP-1A-F9 completed; PP-1B is next

PP-1A is **OWNER APPROVED / CERTIFIED / MERGED** via PR #42. Approved product
head/tree: `35f97b54cd9480f052f3f1606d538b4fee2a5a75` /
`7ce5859d9bd746825ac0e4374a5ae313f15f2907`; merge/main:
`396b2837176bcc86187457e3403a0f91b99f8d40` with the same tree. CI #672,
Runtime #437, Sprint #331, and Runtime/Sprint Playwright 54/54 passed. Owner
visual approval is PASS. PP-1B is the next authorized implementation and must
use the PP-1A tenant Product Catalog as its sole product authority; handoff
requirements are in `PP-1A_F9_FINAL_CERTIFICATION.md`.


## PP-1B-F1 merged; PP-1B-F2A is next

PP-1B-F1 is OWNER APPROVED / CERTIFIED / MERGED via PR #44. The owner-approved
product head is b55348ea8d0822ff1e23d40a97d6e54176e7d760 with product tree
d7425b1fee5ee2aee374b68727c913f0177d0a94. The normal merge commit is
c38d404ee87131fa49166b77d9f9e24c0f1c8cfa. CI #692, Runtime #457, Sprint #351,
and Playwright 55/55 passed before merge; owner visual approval is PASS.

The exact next authorized scope is PP-1B-F2A — Authoritative Product Catalog Case
Builder, Dynamic Product Configuration, Multi-Product Stacking, TAT, and Case
Lifecycle Foundation. The complete scope lock is recorded in
PP-1B_F2A_AUTHORIZED_HANDOFF.md. Do not begin F2A or PP-1C in the F1 merge task.
