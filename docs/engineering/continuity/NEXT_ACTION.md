# Next Action

Last verified: 2026-08-18

## Current authority

The exact authorized next action is:

> **CF-1A2 — Module Entitlements + Seat Pools.**

Recommended implementation model: **GPT-5.6 Terra**.

CF-1A0 is certified and merged via PR #32. CF-1A1 is certified and merged via PR #33 with product head `fd8d0f55322acd16ccc3fa796a6e674564c899c7`, tree `7d4215f00a87743a0fe5d8c09fa163155b323a2a`, merge commit `7d63a55938e4f7a06a6e4219863520ceb716aaae`, and merged-main CI/Runtime/Sprint `32198072606`/`32198072651`/`32198072542` all green; Playwright 47/47.

CF-1A1 removes the legacy-only runtime block by routing tenant-native operational requests through trusted context and tenant-scoped repositories. It is certified and merged.

CF-1A2 must implement reusable module entitlements for `NORTHSTAR_CORE`, `DESIGN_STUDIO`, and `GVM`; NorthStar and independent Design Studio seat pools; entitlement enable/disable; backend/API/service enforcement; and preservation of historical data when disabled.

## Verified baseline

- Product-certified head: `5cc2b4ab2ee0d25d656db7c08b136f7014ff2a4a`
- Product tree: `f764f8622f4d62ca6f62833dc62fded7ff2069e4`
- Restored CF-1A0 product head: `81dd130d369afaf431c479f28b72d74c054bbc50`; product tree: `91dae2d9d40571406b09a13d4640ecead77c33b1`
- PR #29: merged; CI, Runtime Validation, Sprint Validation, 421/421 deterministic, and 47/47 Playwright all passed
- PR #30: merged at `4cdd57090b031b5b71bc811f666710dd99451cec`; documentation/continuity only
- Expanded commercial roadmap: permanently stored
- Sprint 25: fully reconciled, certified, and merged
- No active Sprint 25 blocker remains
- CF-1A0: CERTIFIED AND MERGED via PR #32.
- CF-1A1: CERTIFIED AND MERGED via PR #33.

## Continuity-state semantics

`LAST_REPOSITORY_HEAD_VERIFIED` is the `main` HEAD inspected before the current continuity update. It is not a self-referential invariant. If `main` is later ahead, compare the delta. A verified documentation-only delta may be reconciled without invalidating `PRODUCT_CERTIFIED_HEAD`.

## Explicit sequencing rule

Sprint 26 remains planned after the commercial foundation sequencing decision. Do not begin CF-1A2 or Sprint 26 before the currently authorized sequencing permits it.

This continuity repair does not implement CF-1, Sprint 26, or any product feature. It does not rerun private-corpus certification.
