# CADence NorthStar Current State

Last updated: 2026-08-18

## Authoritative status

- Repository: `CADenceNS/cadence-northstar-build`
- Current phase: Sprint 25 fully reconciled, certified, and merged; CF-1A0 is certified and merged; CF-1A is the next authorized product foundation.
- Sprint 25: **FULLY RECONCILED, CERTIFIED, AND MERGED**
- Sprint 26: **PLANNED AFTER CF-1 / NOT STARTED**
- Product-certified head: `5cc2b4ab2ee0d25d656db7c08b136f7014ff2a4a`; product tree: `f764f8622f4d62ca6f62833dc62fded7ff2069e4`
- Last repository head verified before this continuity update: main `df33a377ce9e8bf63daa7c34b3746f0c3ef859e5`; PR #32 corrective product head is recorded separately below.
- PR #29: merged Runtime export-status/autosave synchronization correction.
- PR #30: merged documentation/continuity-only commercial-platform roadmap baseline at `4cdd57090b031b5b71bc811f666710dd99451cec`.
- Expanded commercial roadmap: permanently stored in the repository.
- No active Sprint 25 blocker remains.
- CF-1A0: **CERTIFIED AND MERGED** via PR #32. Original restored head `81dd130d369afaf431c479f28b72d74c054bbc50` was corrected as product head `e60be1f25cbccbae6770356bf532899a0065033b`, tree `b4b3cdddd1afc45aab1d525a7fcf46f3855d705b`. Main merge commit is `1136a8382e1bc9b1bc045b744235f5dd5ae888fe`, tree `f8e28f3192a333139b55bb10aa795b4f1c05bc3b`; post-merge CI `32110225019`, Runtime `32110225115`, and Sprint `32110225007` PASS. Deterministic regression and Playwright 47/47 remain green. No CAD geometry changed.
- Current limitation: non-legacy commercial tenants intentionally fail closed at the legacy operational runtime until tenant-native operational repositories are implemented in CF-1A.

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

## Current authority

The next authorized product implementation is:

> **Resume CF-1A — Tenant + Entitlement Security Core**

CF-1A0 is certified and merged on corrected product head `e60be1f`; the merged-main continuity head is `1136a838`. Do not begin Sprint 26 before the currently authorized commercial-foundation sequencing permits it.
