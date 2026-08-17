# CADence NorthStar Current State

Last updated: 2026-08-17T00:00:00Z

## Authoritative status

- Repository: `CADenceNS/cadence-northstar-build`
- Current phase: Sprint 25 Runtime export-status correction candidate
- Sprint 26: **BLOCKED / PROHIBITED**
- Current `main`: `495aef43bf6a632b4f60a7f44363bdfea77ac790`
- Current `main` tree: `cc0a8897053a52bce501cb4463e4c1839dccdc0d`
- Current main remains the pre-PR-29 merged baseline; its Runtime export-status/autosave race is not resolved on main.
- Open corrective PR: #29, branch `fix/runtime-export-status-autosave-race`
- PR #29 product head: `1ab7ca80c9f97116744e3929cac935ac77dc1313`
- PR #29 product tree: `f764f8622f4d62ca6f62833dc62fded7ff2069e4`
- PR #29 remains Draft, open, mergeable, and unmerged.

## Candidate certification

PR #29 is green on its exact product head:

- CI `31930669970`
- Runtime Validation `31930670001`
- Sprint 13A Validation `31930669975`
- 421/421 deterministic tests
- 47/47 Playwright tests

The fix exposes the already-persisted `manufacturingState: EXPORTED` in the crown state panel and changes the browser workflow to assert that durable state after all four downloads and after reopen. It does not change crown geometry, margin, intaglio, materials, registration, preparation, thresholds, or geometry algorithms.

The exact private-corpus evidence remains the PR #28 evidence recorded in `CERTIFICATION_LEDGER.md`. No new private-corpus run is claimed for PR #29 because its product change is UI-only and its test change is assertion synchronization only.

## Current blocker and authority

- Blocker: architectural review and merge decision for PR #29, followed by exact merged-main validation.
- Authorized now: review PR #29; if approved, merge it using the established repository strategy and validate the resulting exact `main`.
- Prohibited now: Sprint 26, commercial implementation, restoration expansion, geometry refactoring, threshold changes, and unrelated product work.
- Sprint 26 may be considered only after merged-main CI, Runtime Validation, Sprint Validation, strict TypeScript, production builds, deterministic regression, and Playwright regression are green and architecture authorizes it.

Read `SESSION_HANDOFF.md`, `NEXT_ACTION.md`, and `ENGINEERING_GUARDRAILS.md` before further work.
