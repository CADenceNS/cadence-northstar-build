# Next Action

Last verified: 2026-08-18

## Current authority

The exact authorized next product implementation is:

> **Resume CF-1A — Tenant + Entitlement Security Core**

Recommended implementation model: **GPT-5.6 Terra**.

CF-1A0 is certified and merged via PR #32. The corrected product head is `e60be1f25cbccbae6770356bf532899a0065033b`, tree `b4b3cdddd1afc45aab1d525a7fcf46f3855d705b`; main merge commit is `1136a8382e1bc9b1bc045b744235f5dd5ae888fe`. Post-merge CI `32110225019`, Runtime `32110225115`, and Sprint `32110225007` are green; deterministic and Playwright 47/47 remain green.

Non-legacy commercial tenants intentionally fail closed at the legacy operational runtime until tenant-native operational repositories are implemented in CF-1A.

## Verified baseline

- Product-certified head: `5cc2b4ab2ee0d25d656db7c08b136f7014ff2a4a`
- Product tree: `f764f8622f4d62ca6f62833dc62fded7ff2069e4`
- Restored CF-1A0 product head: `81dd130d369afaf431c479f28b72d74c054bbc50`; product tree: `91dae2d9d40571406b09a13d4640ecead77c33b1`
- PR #29: merged; CI, Runtime Validation, Sprint Validation, 421/421 deterministic, and 47/47 Playwright all passed
- PR #30: merged at `4cdd57090b031b5b71bc811f666710dd99451cec`; documentation/continuity only
- Expanded commercial roadmap: permanently stored
- Sprint 25: fully reconciled, certified, and merged
- No active Sprint 25 blocker remains
- CF-1A0: CERTIFIED_PREREQUISITE on Draft PR #32; only architectural review/merge remains before CF-1A may resume.

## Continuity-state semantics

`LAST_REPOSITORY_HEAD_VERIFIED` is the `main` HEAD inspected before the current continuity update. It is not a self-referential invariant. If `main` is later ahead, compare the delta. A verified documentation-only delta may be reconciled without invalidating `PRODUCT_CERTIFIED_HEAD`.

## Explicit sequencing rule

Sprint 26 remains planned after the commercial foundation sequencing decision. Do not begin Sprint 26 before the currently authorized sequencing permits it.

This continuity repair does not implement CF-1, Sprint 26, or any product feature. It does not rerun private-corpus certification.
