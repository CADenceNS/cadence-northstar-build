# Next Action

Last verified: 2026-08-17

## Current authority

The exact authorized next product implementation is:

> **CF-1A0-C — Complete database-backed and exact-head certification**

Recommended implementation model: **GPT-5.6 Terra**.

CF-1A0 has been restored to remote product head `81dd130d369afaf431c479f28b72d74c054bbc50` with product-source equivalence proven. Complete database-backed and exact-head CF-1A0-C certification before resuming CF-1A.

## Verified baseline

- Product-certified head: `5cc2b4ab2ee0d25d656db7c08b136f7014ff2a4a`
- Product tree: `f764f8622f4d62ca6f62833dc62fded7ff2069e4`
- Restored CF-1A0 product head: `81dd130d369afaf431c479f28b72d74c054bbc50`; product tree: `91dae2d9d40571406b09a13d4640ecead77c33b1`
- PR #29: merged; CI, Runtime Validation, Sprint Validation, 421/421 deterministic, and 47/47 Playwright all passed
- PR #30: merged at `4cdd57090b031b5b71bc811f666710dd99451cec`; documentation/continuity only
- Expanded commercial roadmap: permanently stored
- Sprint 25: fully reconciled, certified, and merged
- No active Sprint 25 blocker remains
- CF-1A0: IMPLEMENTED_PENDING_CERTIFICATION on Draft PR #32. Complete CF-1A0-C against the restored exact product head; no certification is claimed yet.

## Continuity-state semantics

`LAST_REPOSITORY_HEAD_VERIFIED` is the `main` HEAD inspected before the current continuity update. It is not a self-referential invariant. If `main` is later ahead, compare the delta. A verified documentation-only delta may be reconciled without invalidating `PRODUCT_CERTIFIED_HEAD`.

## Explicit sequencing rule

Sprint 26 remains planned after the commercial foundation sequencing decision. Do not begin Sprint 26 before the currently authorized sequencing permits it.

This continuity repair does not implement CF-1, Sprint 26, or any product feature. It does not rerun private-corpus certification.
