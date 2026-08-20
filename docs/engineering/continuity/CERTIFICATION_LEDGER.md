Warning: truncated output (original token count: 4665)
Total output lines: 122

# Certification Ledger

## CF-1A3B Platform Admin Commercial Management UI

- Status: **CERTIFIED_PREREQUISITE** on Draft PR #37; unmerged pending architectural review.
- Certified product head: `0535e8c433226c167cca85ffefd83d50ee1d57db`; product tree: `2b72dce8956e940d93e6513567d19039c1609e8c`.
- Exact-head evidence: CI #620 PASS; Runtime Validation #385 PASS; Sprint 13A Validation #279 PASS; Runtime/Sprint Playwright 51/51.
- Scope: Platform Admin-only lab directory and detail, activation issue/revoke/rotate with one-time secret display and clearing, server-backed entitlement and independent seat controls, lifecycle controls, commercial audit history, and tenant operational-data boundary.
- Regression evidence: migrations through 0010, tenant-native security, CF-1A2 entitlement/seat, and CF-1A3A activation/licensing regressions PASS. Commercial UI fixtures provision and mutate unique tenants, preserving shared test-state isolation.
- Explicit non-claims: subscription billing, GVM functionality, and white-labeling are not complete; GVM remains entitlement registration only. No CAD geometry changed and no private dental corpus was run.
- Authorized next action: **Architectural review / merge decision for PR #37.** Recommended model: **GPT-5.6 Luna**. Do not merge automatically or begin CF-1B/Sprint 26 in this task.

## CF-1A3A activation licensing and Platform Admin commercial control plane

- Status: **CERTIFIED AND MERGED** via PR #36.
- Certified product head: `53b4773aaa9cfe807f12ff77c9da215eb39d6074`; product tree: `778d358c653200a5276434e00da59e41e6bfad48`.
- Merge commit: `55e34f983bf18cc8cd35660ed0b318e953b782d4`; merged-main tree: `778d358c653200a5276434e00da59e41e6bfad48`.
- Merged-main evidence: CI #613 PASS; Runtime Validation #378 PASS; Sprint 13A Validation #272 PASS; deterministic 421/421; Runtime/Sprint Playwright 49/49.
- Regression evidence: migration 0010, tenant-native security, entitlement/seat, commercial activation/licensing, sequential DB, and commercial-account uniqueness PASS.
- Scope: hashed one-time activation credentials, lifecycle controls, immutable commercial audit events, and Platform Admin-only commercial APIs. No CAD geometry changed.
- Explicit non-claims: Platform Admin management UI, subscription billing, GVM functionality, and white-labeling are not complete.
- Authorized next action: **CF-1A3B — Platform Admin Commercial Management UI**. Recommended model: **GPT-5.6 Terra**. Do not begin CF-1A3B in this task.


This ledger separates immutable product commits from later merge or continuity-only commits. A PR description is historical evidence, not a substitute for an immutable workflow result. Private-corpus evidence is labeled historical unless it was independently rerun against the named exact head.

## Certified and reconciled milestones

## CF-1A1 laboratory tenant model and tenant-native operational isolation

- Product implementation head: `fd8d0f55322acd16ccc3fa796a6e674564c899c7`; product tree `7d4215f00a87743a0fe5d8c09fa163155b323a2a`.
- Draft PR #33 current head: `ec020cc8ab8f8f781ffa694f580333834f1820bd`; compare against the product head is continuity documentation only in `CURRENT_STATE.md`, `SESSION_HANDOFF.md`, `NEXT_ACTION.md`, and `FEATURE_STATUS_MATRIX.md`.
- Scope: first-class tenant lifecycle and membership records, deterministic legacy-data migration ledger, tenant-native operational repository and artifact metadata scope, server-derived context, cross-tenant read/write/delete/list/search denial, and browser gateway isolation. No CAD geometry changed.
- Targeted DB/UAT, migration, auth/RBAC, deterministic, and browser isolation evidence passed. Runtime Validation `32159092377` passed on the documentation-tail head with product source unchanged; Playwright 47/47. CI `32156684645` and Sprint 13A Validation `32156684744` passed on the exact product head.
- The original Runtime attempt `32156684716` reached 46/47 because an inherited Design Studio responsiveness assertion measured 265.2 ms against its existing 250 ms bound. The unchanged retry was cancelled when the continuity-only PR head advanced; the later Runtime run `32159092377` is the valid green evidence.
- Outcome: **CERTIFIED AND MERGED** via PR #33. Merge commit `7d63a55938e4f7a06a6e4219863520ceb716aaae`; merged-main tree `7a863d8985e52be0e0cba135a86fb4bd84f283fc`. Merged-main CI `32198072606`, Runtime Validation `32198072651`, and Sprint 13A Validation `32198072542` passed; both browser workflows passed 47/47. Authorized next action is CF-1A2 — Module Entitlements + Seat Pools. Sprint 26 remains blocked.

## CF-1A0 authenticated tenant-context boundary

- Original preserved checkpoint: `7d10e0f60ec6f3247df134f5db13596c5f6e368c`.
- Restored product head: `81dd130d369afaf431c479f28b72d74c054bbc50`, tree `91dae2d9d40571406b09a13d4640ecead77c33b1`.
- Corrective certified product head: `e60be1f25cbccbae6770356bf532899a0065033b`, tree `b4b3cdddd1afc45aab1d525a7fcf46f3855d705b`; PR merge tree `b4b3cdddd1afc45aab1d525a7fcf46f3855d705b` is identical.
- Scope: restored fail-closed protection preventing an authenticated non-legacy tenant from entering the default legacy operational runtime. Signed tenant assertions remain required at the downstream boundary; no CAD geometry changed.
- Exact PR workflows: CI `32108187326` PASS; Runtime Validation `32108187313` PASS; Sprint 13A Validation `32108187317` PASS. Deterministic suite PASS; Playwright 47/47 in both Runtime and Sprint workflows.
- Main merge commit: `1136a8382e1bc9b1bc045b744235f5dd5ae888fe`; main tree `f8e28f3192a333139b55bb10aa795b4f1c05bc3b`.
- Post-merge exact-main workflows: CI `32110225019` PASS; Runtime Validation `32110225115` PASS; Sprint 13A Validation `32110225007` PASS. Deterministic regression remained PASS and Playwright remained 47/47. Private dental corpus was not rerun because no geometry changed.
- Limitation: non-legacy commercial tenants intentionally fail closed at the legacy operational runtime until…1665 tokens truncated…ws passed, including 421/421 deterministic and 47/47 Playwright tests. This was an assertion correction, not a product, geometry, threshold, or acceptance-bound change.
- Product-certified head `2f8e7c4`, tree `03f5b44`, retained those exact public gates in CI `31850602483`, Runtime `31850602478`, and Sprint `31850602487`; no later commit appeared before the private gate.
- Restricted corpus v0.3 archive SHA-256 `f3f7ffe54c9644939b103fe3ee0bc99000413c32fc65212ab838d595bde352cb` passed all 23 integrity entries with confirmed owner attestation. Core private suites passed 99/99 (91 registration + 4 preparation + 4 crown); the supplemental corrective invariant suite passed 3/3.
- Controlled private-derived proximal correction changed editable non-margin support while leaving all 24 margin and 145 intaglio vertices exact (`0 mm` maximum). Static-occlusion editing preserved the same protected regions. The infeasible input reported `constraint-conflict`, retained valid geometry, entered `QC_FAILED`, and blocked approval/release.
- Derived crown round trips passed binary STL, ASCII STL, OBJ, and PLY with maximum surface deviation `8.738665739279973e-7 mm` under the unchanged `0.001 mm` tolerance. Save/reopen, auto-save, recovery, protected locks, contact/QC state, and geometry lineage persisted. No byte-identical source geometry entered git or build output; reports excluded source geometry and original identifying filenames.

## Sprint 25B scope actually added

Commit `234ecce` changed 30 files (+1,764/−220) and materially added or completed:

- seven governed material profiles and per-profile design/QC rules;
- complete permanent-tooth numbering/morphology governance;
- 17 sculpt modes, 25 named anatomy operations, locks/masks/overlays, and 81 crown registry capabilities;
- constrained joint optimization, contour analysis/correction, richer intaglio and export evidence;
- immutable restoration history/checkpoint/branch behavior;
- a 15-case required failure corpus, browser assertions, private crown harness, and the machine-readable 712-row compliance matrix.

The final universal Tool Coverage Registry is 219 production-ready entries: 84 base + 54 preparation/margin + 81 crown.

## Material profile certification evidence

All profiles are repository-governed for `single-unit-tooth-supported-crown`, declare `clinicalApprovalClaimed: false`, have six hard validation rules, feed parameter validation and crown QC, and are directly exercised with generated valid geometry in `crown-history-materials.test.ts`.

| Profile | Version | Minimum thickness mm (margin / axial / occlusal / incisal) | Cement default; marginal default; spacer default mm (axial / occlusal / start) | Internal radius; manufacturing allowance; tool access mm | Minimum tool; modes |
|---|---:|---|---|---|---|
| `zirconia-monolithic` | 2.0.0 | 0.35 / 0.60 / 1.00 / 1.00 | 0.060; 0.030; 0.060 / 0.090 / 0.600 | 0.40; 0.02; 0.10 | 0.60 mm; milled |
| `zirconia-high-translucency` | 1.0.0 | 0.40 / 0.80 / 1.10 / 1.10 | 0.065; 0.035; 0.065 / 0.095 / 0.600 | 0.45; 0.025; 0.12 | 0.60 mm; milled |
| `lithium-disilicate` | 2.0.0 | 0.40 / 0.80 / 1.50 / 1.50 | 0.070; 0.040; 0.070 / 0.100 / 0.600 | 0.50; 0.03; 0.12 | 0.80 mm; milled, pressed |
| `pmma-provisional` | 1.0.0 | 0.50 / 1.00 / 1.50 / 1.50 | 0.090; 0.050; 0.090 / 0.120 / 0.600 | 0.60; 0.05; 0.15 | 1.00 mm; milled, printed-pattern |
| `full-cast-metal` | 1.0.0 | 0.30 / 0.50 / 0.80 / 0.80 | 0.055; 0.030; 0.055 / 0.085 / 0.600 | 0.35; 0.03; 0.08 | N/A with justification: cast/pattern modes do not require a universal minimum mill diameter; cast, printed-pattern, milled |
| `pfm-coping` | 1.0.0 | 0.30 / 0.50 / 0.60 / 0.60 | 0.055; 0.030; 0.055 / 0.085 / 0.600 | 0.35; 0.04; 0.10 | N/A with justification: supported cast/layered modes do not require a universal minimum mill diameter; cast, printed-pattern, milled, layered |
| `hybrid-ceramic` | 2.0.0 | 0.45 / 0.80 / 1.20 / 1.20 | 0.080; 0.045; 0.080 / 0.110 / 0.600 | 0.50; 0.04; 0.12 | 0.80 mm; milled |

Additional governed values—global/cusp/fossa thickness, cement and marginal ranges, proximal/occlusal targets, compensation range/default, sharp-projection limit, and compatibility—remain authoritative in `apps/design-studio/src/morphology-core.ts`.


## Current merged baseline — PR #29 Runtime correction

- Product head: PR #29, `1ab7ca80c9f97116744e3929cac935ac77dc1313`.
- Merge commit: `5cc2b4ab2ee0d25d656db7c08b136f7014ff2a4a`.
- Product tree: `f764f8622f4d62ca6f62833dc62fded7ff2069e4`.
- Scope: expose the existing durable `manufacturingState: EXPORTED` and assert it after export and reopen. The stale transient status-bar observation was removed.
- Changed product/test files: `apps/design-studio/src/CrownWorkspace.tsx` and `tests/e2e/design-studio-single-crown.spec.mjs`.
- Geometry boundary: no crown geometry, margin, intaglio, material, registration, preparation, threshold, or geometry-algorithm code changed.
- Merged-main workflows: CI `31984965584` PASS; Runtime Validation `31984965612` PASS; Sprint 13A Validation `31984965614` PASS.
- Merged-main regression: 421/421 deterministic and 47/47 Playwright.
- Private evidence: PR #28's exact protected-corpus and geometry evidence remains authoritative; no new private-corpus run is claimed for this UI/test-only correction.
- Outcome: Sprint 25 is fully reconciled and merged. Later continuity commits remain documentation-only and are not product certification heads.


## Documentation-only reconciliation — PR #30

- Documentation merge commit: `4cdd57090b031b5b71bc811f666710dd99451cec`.
- Documentation tree: `482a7707fe4dfd41646d55f6e17932d0b8f6ee69`.
- PR #30 changed nine documentation/continuity files and no product or test source.
- PR #30 workflows on docs head `d0d79034e4e508846f62436dfb3b8d135a229363`: CI `31985580983` PASS; Runtime `31985580942` PASS; Sprint `31985580947` PASS.
- Product certification remains bound to product head `5cc2b4ab`; this later commit is continuity-only.
