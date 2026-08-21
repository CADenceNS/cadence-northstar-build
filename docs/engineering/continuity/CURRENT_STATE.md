# CADence NorthStar Current State

Last updated: 2026-08-20

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

## Locked design authority

`NORTHSTAR_DESIGN_LANGUAGE = NSDL v1.0`; `DESIGN_AUTHORITY = OWNER LOCKED`; `REFERENCE = CADence NorthStar v3.9 — NSDL First View`; `FOUNDATION_UI = FROZEN REFERENCE`; `NO_UNAUTHORIZED_REDESIGN = TRUE`.

The rejected Sprint-era shell is not a future visual baseline. NSDL candidate work must remain unmerged until owner visual review is complete.

## Current authority

The next authorized action is:

> **OWNER VISUAL REVIEW OF CORRECTED CADENCE NORTHSTAR PREVIEW.**

Preview URL: `https://cadence-northstar-preview.onrender.com`. GitHub certification is complete, but owner visual acceptance is intentionally pending. Do not authorize CF-1B, Sprint 26, or another implementation phase before this review.
