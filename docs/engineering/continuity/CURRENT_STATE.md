# CADence NorthStar Current State

Last updated: 2026-08-15T00:46:46Z

## Authoritative status

- Repository: `CADenceNS/cadence-northstar-build`
- Phase: Sprint 25 post-merge correction; final private-corpus gate complete; architectural review pending
- Sprint 26: **PROHIBITED**
- Current `main`: `b53cdd86c2e4eb61e1931c816c34703aa8614823`
- Current `main` tree: `e9a8470c70708a411d410cfd1c3d7a4793da5eac`
- Main production baseline: merged PR #27; no post-merge commits were present when reconciliation began
- Corrective PR: draft PR #28, `fix/sprint-25-post-merge-compliance`
- Corrective product commit: `77b631f2b011c6ce8603e5de5aef12202f7f4d22`
- Corrective product tree: `9f9ef73811a5c04ea30cd017fcb07b57ead75e3c`
- Corrective certification-test head: `05eea8abe7c071c4476c1984f77b49db85680551`
- Corrective certification-test tree: `507ba1037eba781f4e37ad07676572e2ea6494d9`
- Product-certified PR head: `2f8e7c410123386011bf94fbaeb8e147bec92953`
- Product-certified PR tree: `03f5b445ff2c7f88daae8e247d23ddf01c77ce45`

## Certification state

`main` is **not a valid fully reconciled Sprint 25 certification baseline**. The final PR #27 proximal-contact change can move the approved margin while the margin lock is active.

PR #28 restores the non-margin correction domain and adds direct feasible and infeasible locked-margin regressions. The original symmetric posterior fixture is proven infeasible under the immutable approved margin: the optimizer reports `best-effort`, hard QC fails, the restoration enters `QC_FAILED`, and approval/export remain disabled. A separately feasible posterior fixture converges without changing the margin, intaglio, or preparation source. No governed threshold was relaxed.

The exact product-certified PR head `2f8e7c4` passed 421/421 deterministic tests across 41 suites and 47/47 Playwright tests. CI `31850602483`, Runtime Validation `31850602478`, and Sprint Validation `31850602487` all passed on that head. Supplemental public audit coverage remains 143 crown tests across 11 suites. PR #28 is open, Draft, mergeable, and has no unresolved review thread.

The protected corpus v0.3 final gate was independently rerun against `2f8e7c4`: archive SHA-256 `f3f7ffe54c9644939b103fe3ee0bc99000413c32fc65212ab838d595bde352cb`, integrity 23/23, owner attestation confirmed, registration 91/91, preparation 4/4, and crown robustness 4/4. A supplemental private PR #28 invariant suite passed 3/3. It checked 24 margin vertices and 145 protected intaglio vertices with `0 mm` maximum displacement, preserved all source geometry byte-for-byte, produced governed-pass controlled proximal contacts, preserved the same protected regions during static-occlusion editing, and kept an infeasible case fail-closed as `constraint-conflict` / `QC_FAILED` with approval and release blocked. Binary STL, ASCII STL, OBJ, and PLY all passed re-import at a maximum surface deviation of `8.738665739279973e-7 mm` under the unchanged `0.001 mm` tolerance; save/reopen, auto-save, crash recovery, locks, measured states, QC state, and lineage were preserved.

The final privacy sweep found no tracked private geometry, no source-hash match in the repository or production build output, no private geometry in reports, and no identifying original filename in reports. Product files were not changed by the private gate.

This file is published in a later continuity-only commit. The final branch-head workflow results cannot be self-recorded inside that same immutable commit; PR #28's final exact-head certification comment is the authoritative pointer for the continuity-only head.

## Current blocker and authority

- Blocker: final architectural merge review of the fully public-and-private-certified corrective result.
- Authorized next action: architectural review of draft PR #28 and a merge/no-merge decision only. No further implementation or sprint work is authorized.
- Prohibited: merging PR #28 without architectural approval; starting Sprint 26; adding restoration features; refactoring crown geometry; changing morphology, materials, registration, preparation/margin behavior, or certification thresholds outside the proven correction.

Read `SESSION_HANDOFF.md` and `ENGINEERING_GUARDRAILS.md` before taking any action.
