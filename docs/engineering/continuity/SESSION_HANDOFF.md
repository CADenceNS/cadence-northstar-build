# Session Handoff

Repository: `CADenceNS/cadence-northstar-build`

Read first:

1. `docs/engineering/continuity/CURRENT_STATE.md`
2. `docs/engineering/continuity/SESSION_HANDOFF.md`
3. `docs/engineering/continuity/ENGINEERING_GUARDRAILS.md`
4. `docs/engineering/continuity/REQUIREMENT_COMPLIANCE.md`

Current `main`: `b53cdd86c2e4eb61e1931c816c34703aa8614823`, tree `e9a8470c70708a411d410cfd1c3d7a4793da5eac`.

Current corrective work: draft PR #28, branch `fix/sprint-25-post-merge-compliance`; product commit `77b631f2b011c6ce8603e5de5aef12202f7f4d22`, product tree `9f9ef73811a5c04ea30cd017fcb07b57ead75e3c`.

Phase: Sprint 25 post-merge correction and exact-head recertification.

Exact blocker: PR #27's final proximal-domain change moved 32/48 approved margin vertices (maximum `0.7500000000000004 mm`) while the margin lock was active and still reported convergence. PR #28 corrects the edit domain and adds the missing invariant. Exact-current-head Runtime and Sprint workflows, continuity publication, and architectural review must complete.

Authorized next action: verify the latest PR #28 head and tree, wait for CI/Runtime/Sprint completion, inspect exact-head logs for frozen install/typecheck/build/420 deterministic/46 Playwright evidence, update `CURRENT_STATE.md` and this handoff with immutable IDs, then stop for architectural review.

Required gate: 709 verified + 3 justified N/A + 0 partial + 0 missing; 219 registry entries; frozen install; strict TypeScript; all builds; full deterministic and 46 Playwright tests; CI, Runtime, and Sprint green on the same head; private integrity/91+4+4 only if the protected corpus is available. Do not claim a private rerun otherwise.

Prohibited: do not merge without architecture approval; do not start Sprint 26; do not add features, weaken tests/thresholds, or broaden the correction.
