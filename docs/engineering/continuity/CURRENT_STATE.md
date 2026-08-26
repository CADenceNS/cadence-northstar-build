# CADence NorthStar Current State

Last updated: 2026-08-21

## Authoritative status

- Repository: `CADenceNS/cadence-northstar-build`
- Current phase: CF-1A0, CF-1A1, CF-1A2, CF-1A3A, and CF-1A3B are **CERTIFIED AND MERGED** through main merge `e03f85144f31533e8785588c5cf1514a92184ab1` (tree `e30b3b43f74f4b32cbe729ef8188aaa5d596fb6e`).
- Sprint 25: **FULLY RECONCILED, CERTIFIED, AND MERGED**
- Sprint 26: **PLANNED AFTER CF-1 / NOT STARTED**
- Product-certified head: `53b4773aaa9cfe807f12ff77c9da215eb39d6074`; product tree: `778d358c653200a5276434e00da59e41e6bfad48`
- Last repository head verified before this continuity update: main `55e34f983bf18cc8cd35660ed0b318e953b782d4` (merge commit); the continuity-only update is recorded separately.
- PR #29: merged Runtime export-status/autosave synchronization correction.
- PR #30: merged documentation/continuity-only commercial-platform roadmap baseline at `4cdd57090b031b5b71bc811f666710dd99451cec`.
- Expanded commercial roadmap: permanently stored in the repository.
- No active Sprint 25 blocker remains.
- CF-1A0: **CERTIFIED AND MERGED** via PR #32. Original restored head `81dd130d369afaf431c479f28b72d74c054bbc50` was corrected as product head `e60be1f25cbccbae6770356bf532899a0065033b`, tree `b4b3cdddd1afc45aab1d525a7fcf46f3855d705b`. Main merge commit is `1136a8382e1bc9b1bc045b744235f5dd5ae888fe`, tree `f8e28f3192a333139b55bb10aa795b4f1c05bc3b`; post-merge CI `32110225019`, Runtime `32110225115`, and Sprint `32110225007` PASS. Deterministic regression and Playwright 47/47 remain green. No CAD geometry changed.
- CF-1A1: **CERTIFIED AND MERGED** via PR #33. Product implementation head `fd8d0f55322acd16ccc3fa796a6e674564c899c7`, tree `7d4215f00a87743a0fe5d8c09fa163155b323a2a`; merge commit `7d63a55938e4f7a06a6e4219863520ceb716aaae`, merged-main tree `7a863d8985e52be0e0cba135a86fb4bd84f283fc`. Merged-main CI `32198072606`, Runtime `32198072651`, and Sprint `32198072542` PASS; deterministic PASS and Playwright 47/47. Tenant-native DB/UAT, auth/RBAC, migration, and isolation evidence remained green. No CAD geometry changed.
- CF-1A3A: **CERTIFIED AND MERGED** via PR #36. Certified product head `53b4773aaa9cfe807f12ff77c9da215eb39d6074`, tree `778d358c653200a5276434e00da59e41e6bfad48`; main merge commit `55e34f983bf18cc8cd35660ed0b318e953b782d4`. Merged-main CI #613, Runtime Validation #378, and Sprint 13A Validation #272 passed; deterministic regression was 421/421 and Runtime/Sprint Playwright was 49/49. Migration 0010, tenant-native security, entitlement/seat, activation/licensing, sequential DB, and commercial-account uniqueness regressions passed. No CAD geometry changed.
- CF-1A3B: **CERTIFIED AND MERGED** via PR #37. Certified product head `0535e8c433226c167cca85ffefd83d50ee1d57db`, tree `2b72dce8956e940d93e6513567d19039c1609e8c`; main merge `e03f85144f31533e8785588c5cf1514a92184ab1`, tree `e30b3b43f74f4b32cbe729ef8188aaa5d596fb6e`; CI #622, Runtime Validation #387, and Sprint 13A Validation #281 passed. Runtime and Sprint Playwright each passed 51/51. Subscription billing, GVM functionality, white-label management, and public production deployment are not complete. No CAD geometry changed.
- VIS-1B: **CERTIFIED AND MERGED** via PR #38. Runtime head `0033ecc7363274821e81806fa6b71bfd4d2fe7cb`, tree `616a00d409cf98ff64255c8545efbcfc13a4d143`; merge commit `d2f4d3e01cfd25ec95104f8e71f7795a8e9de889`. CI #625, Runtime Validation #390, and Sprint 13A Validation #284 passed; Runtime and Sprint Playwright each passed 51/51. Production API start/health, PORT handling, external migrations 0001–0010, security/UAT, tenant isolation, Platform Admin boundary, NorthStar build, and Design Studio build passed. No deployment or DNS action occurred; no CAD geometry changed.
- VIS-1D: **CERTIFIED AND MERGED** via PR #39. Certified implementation head `b87222b0888c1ac93833a2808bdd6a6ba574b76e`, product/runtime tree `828fd6477a64810e1d32996f6672c564a8f1569a`; merge commit `ff70baa3bfbde7a928ca6b708a1de4e9b593fd69`; merged-main tree unchanged. CI #629, Runtime Validation #394, and Sprint 13A Validation #288 passed; Runtime and Sprint Playwright each passed 51/51. Owner-facing shell identity now renders CADence NorthStar, while the existing server-backed Platform Admin commercial console, tenant-scoped routing, authentication, CSRF, cookies, entitlements, seats, migrations, and Design Studio geometry remain unchanged. `OWNER_PREVIEW_VISUAL_ACCEPTANCE = PENDING` for the Render preview `https://cadence-northstar-preview.onrender.com`.

## Continuity-state semantics

`PRODUCT_CERTIFIED_HEAD` identifies the exact commit containing the currently certified product implementation. It remains distinct from later documentation commits.

`LAST_REPOSITORY_HEAD_VERIFIED` identifies the `main` HEAD inspected before the current continuity update. It is a verification checkpoint, not a self-referential SHA invariant.

`CONTINUITY/DOCUMENTATION COMMITS` may advance `main` beyond `LAST_REPOSITORY_HEAD_VERIFIED` without invalidating product certification when the intervening delta is verified to contain only continuity, architecture, roadmap, ledger, or other clearly non-product documentation and `PRODUCT_CERTIFIED_HEAD` is unchanged. A future session must compare that delta before deciding whether to stop.

## VIS-2C-F2 supplemental Product & Pricing / Case Configuration scope

VIS-2C-F2 includes an OWNER-APPROVED PERMANENT REQUIREMENT — DOCUMENTED, NOT IMPLEMENTED.
The complete verbatim requirement and initial FIX/REM/IMP/ORT/SLP/DIA/SPL/AUX catalog are
preserved in PRODUCT_PRICING_CASE_CONFIGURATION_REQUIREMENTS.md. The eight statuses are:
PRODUCT_CATALOG=PARTIAL; PRICING_ENGINE=NOT STARTED; MULTI_PRODUCT_CASE_STACKING=PARTIAL;
CATEGORY_FILTERING=NOT STARTED; ARCH_TOOTH_CONFIGURATION=PARTIAL;
BUSINESS_DAY_TAT_ENGINE=PARTIAL; PRICE_VERSIONING=NOT STARTED;
CASE_TO_BILLING_PRODUCT_LINEAGE=PARTIAL. No Product & Pricing implementation or Design
Studio geometry change occurred.

## VIS-2C foundation lock

VIS-2C is **OWNER APPROVED / CERTIFIED / MERGED** via PR #41. Owner-approved product
source head: `fbddd1e557ede27a2e7e51ebba0b314a2a32d284`; documentation-only tail:
`bd897fccd808260dc6f91f3e0a977219ea6c442b`; merge commit and resulting main:
`bb50dfc8dc344b4e2cf173620c79bc342754c85f`; product/runtime tree:
`435117dc1bde03d0075dc1d93f9a7eaee19edcc1`. CI #638, Runtime #403, and Sprint #297
passed; both browser workflows passed 51/51. Production builds, migrations 0001–0010,
authentication/session, CSRF, tenant isolation, Platform Admin boundary, entitlements,
seats, Design Studio access, and Intake Administration passed. No private dental corpus
was run and no Design Studio geometry changed.

`OWNER_VISUAL_ACCEPTANCE = PASS`.
`NORTHSTAR_UI_FOUNDATION = v4.2-derived owner-approved workspace`.
`DESIGN_STUDIO_UI_FOUNDATION = current owner-approved CADence Design Studio`.
`UI_POLICY = additive only; no foundational redesign without explicit owner approval`.

## Merged product certification

PR #29 corrected stale browser observation of export completion:

- Product head: `1ab7ca80c9f97116744e3929cac935ac77dc1313`
- Merge commit / product-certified head: `5cc2b4ab2ee0d25d656db7c08b136f7014ff2a4a`
- Product tree: `f764f8622f4d62ca6f62833dc62fded7ff2069e4`
- CI: `31984965584` PASS
- Runtime Validation: `31984965612` PASS
- Sprint 13A Validation: `31984965614` PASS
- Deterministic regression: 421/421
- Playwright regression: 47/47

The correction observes durable `manufacturingState: EXPORTED` after export and reopen. It changed no crown geometry, margin, intaglio, materials, registration, preparation, thresholds, or geometry algorithms. The protected private-corpus evidence remains the authoritative geometry evidence; no new private-corpus run is claimed for this UI/test-only correction.

## Current authority

## Owner visual-reference authority

The owner-supplied `CADence_NorthStar_v4_2_SCULPT_CUT_NAVIGATION_OPEN_FIRST.zip` is the
visual, interaction, and workspace-architecture authority for the NorthStar restoration.
Current main remains the functional, security, persistence, and commercial authority.
PR #40 is rejected for visual acceptance and must not be used as a visual baseline.
Any resulting UI branch requires live owner visual approval before it may be certified or merged.

The next authorized action is:

> **PP-1A — PRODUCT CATALOG, PRICING FOUNDATION & CASE PRODUCT LINE-ITEM ARCHITECTURE**

Use `PRODUCT_PRICING_CASE_CONFIGURATION_REQUIREMENTS.md` as the authoritative owner
requirement. PP-1A is not started inside VIS-2C. Do not begin CF-1B or Sprint 26.

## VIS-2C-R1 remote reconciliation

The local recovery source and actual remote repository are reconciled. `PRODUCT_CERTIFIED_HEAD` remains
`fbddd1e557ede27a2e7e51ebba0b314a2a32d284`; `REMOTE_MERGE_HEAD` is
`bb50dfc8dc344b4e2cf173620c79bc342754c85f`; and the verified remote `main` tip is
`0a97ac83d860f264dcd3248134b20ce541140031` with tree `72c1abe673a3663ec2e446b83da6407aa984f078`.
Local/remote product-source equivalence is PASS; post-merge changes are continuity documentation only.
`VIS-2C = OWNER APPROVED / CERTIFIED / MERGED / REMOTE RECONCILED` and `OWNER_VISUAL_ACCEPTANCE = PASS`.

## PP-1A-F9 current certified state

PP-1A is **OWNER APPROVED / CERTIFIED / MERGED**. PR #42 product head/tree:
`35f97b54cd9480f052f3f1606d538b4fee2a5a75` /
`7ce5859d9bd746825ac0e4374a5ae313f15f2907`; merge/main:
`396b2837176bcc86187457e3403a0f91b99f8d40` with the same tree. CI #672, Runtime
#437, Sprint #331, and Runtime/Sprint Playwright 54/54 passed. Owner visual
approval is PASS; Design Studio is unchanged. PP-1B is next authorized future
scope; no PP-1B or PP-1C implementation is present.

## PP-1B-F1 Case Journey Foundation — in progress

The `feature/pp-1b-case-journey-foundation` Draft-PR work is the only authorized
PP-1B implementation. Its status is **PARTIAL / awaiting exact-head validation and
owner Render review**. It adds no PP-1B-F2 Product Catalog Case Builder, PP-1C,
Logistics, MES, Clinic Supply, or Design Studio work. See
`PP-1B_F1_IMPLEMENTATION_STATUS.md`.
