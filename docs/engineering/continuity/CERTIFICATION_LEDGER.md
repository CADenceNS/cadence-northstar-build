# Certification Ledger

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
- Limitation: non-legacy commercial tenants intentionally fail closed at the legacy operational runtime until tenant-native operational repositories are implemented in CF-1A.
- Outcome: **CERTIFIED AND MERGED** via PR #32. CF-1A is the next authorized product foundation.

| Milestone | PR and immutable product head | Product tree / merge | Public deterministic and browser evidence | Private evidence | Workflow evidence | Outcome |
|---|---|---|---|---|---|---|
| Sprint 22 / 22A | PR #22, `1e66ec69deb005094a36d0f23764813a771b4b70` | Tree `db6ac43d9f8bda9d9ca0422e736fef0a82c4cb46`; merged as `eaed7d14b677987c73c035a08fecaeacae7d71b7` | 82/82 Design Studio; 34/34 Playwright | Historical PR evidence: v0.3 integrity 23/23, private 91/91, source immutable | CI: no run associated with the head was returned; Runtime `31253204043` pass; Sprint `31253204046` pass | Merged 2026-08-08. Certified scan registration, bite-evidence assembly, dental XYZ normalization, fallback, persistence/recovery, and fail-closed support classes. No direct upper/lower occlusion inference, clinical/manufacturing claim, or self-intersection claim. |
| Sprint 23 / 23A | PR #23, `49fbbc321d85dbadd3865f8de412243c8a566b51` | Tree `b8534f58f800a47af07c3d064923ebca4a69d6de`; merged as `ec21d4fa62821736fce80db20502cb828b551eb0` | 224/224 across 24 suites; 40/40 Playwright; 84/84 production tools | Historical PR evidence: registration 91/91, source immutable | CI: no run associated with the head was returned; Runtime `31382810767` pass; Sprint `31382810790` pass | Merged 2026-08-11. Certified universal versioned geometry editing, exact intersection classification, projected closed-curve trim, commands/history/persistence/recovery. Adaptive floating-point tolerances; no performance SLA. |
| Sprint 24 | PR #24, `4ee517a71dde834a4d31976c9d5a1dbd8797b00f` | Tree `2b34e58367bd53d1e51f7bd0247713d5216720de`; merged as `0465e049980415d41b8e28ff6d019a202c7f3de1` | 278/278; 44/44 Playwright; 138/138 production tools | Historical PR evidence: 95/95 (91 registration + 4 preparation), 11 source scans immutable | CI: no run associated with the head was returned; Runtime `31461228934` pass; Sprint `31461228915` pass | Merged 2026-08-11. Certified preparation identification, segmentation, axis/draw analysis, margin intelligence/editing, QC, lineage, multi-preparation/bridge, persistence/recovery. Real scans without verified truth support robustness only. |
| Sprint 25 draft | PR #25 | Current PR metadata resolves the head to base `82c24a9cb183a35cf048f86e9ba892b8d08bac08`, with 0 commits and 0 changed files; closed, draft, unmerged | Its body reports candidate results, but no distinct immutable final product head remains attached | Historical claims only | Not used | Stale/abandoned checkpoint. It is not a certification or merge milestone. |
| Sprint 25A | PR #27 commit `72add66b8479f417ef1331a12f87990149d907b6` | Tree `67657872fa82970364ac61626172f8976741d403` | 320/320 Design Studio across 36 suites; 46/46 Playwright | Historical prior-session evidence only; not rerun here | CI `31572670010` pass; Runtime `31572670099` pass; Sprint `31572670032` pass | Previously certified implementation checkpoint. It did not contain the full 712-requirement closure. |
| Sprint 25B implementation | PR #27 commit `234eccebb474f57dad3d71f325ad4c79475533f6` | Tree `a9fed5d2cdbf31836a7c18c6412ed6e318a20c7b` | Added the 712-row matrix, materials, morphology/lock/optimizer/history/export coverage, failure and browser evidence. CI passed, but both browser workflows failed at this exact head. | Added crown corpus harness; no independent rerun here | CI `31740057546` pass; Runtime `31740057557` fail; Sprint `31740057514` fail | Sprint 25B **did occur as implementation and audit work**, but this commit was not certified. |
| Sprint 25C label reconciliation | No repository branch, PR, commit title, or document explicitly uses “Sprint 25C” | Forensic classification only: `0bc4ba1` through `6bbffdb` form the browser/certification-hardening tail after 25B | Final PR #27 head: 420/420 across 41 suites; 46/46 Playwright | Historical PR claim: 99/99 (91 registration + 4 preparation + 4 crown), not rerun here | CI `31749154678`; Runtime `31749154663`; Sprint `31749154682`, all pass | Do not treat “25C” as a historical repository label. The inferred stabilization lane reached green workflows but introduced the margin-lock defect in its final commit. |
| Sprint 25 merged baseline | PR #27, `6bbffdb9f494aee642d39f3503db533cbf458350` | Tree `e9a8470c70708a411d410cfd1c3d7a4793da5eac`; merge `b53cdd86c2e4eb61e1931c816c34703aa8614823`, same tree | 420/420 and 46/46 on PR head; same public suites green after merge | Historical PR claim 99/99; not mounted here | PR: CI `31749154678`, Runtime `31749154663`, Sprint `31749154682`; post-merge: CI `31775108836`, Runtime `31775108814`, Sprint `31775108844`; all pass | Merged 2026-08-14. Reconciliation invalidated the full-certification claim because the proximal solver silently moved a locked margin. |
| Sprint 25 post-merge correction | Draft PR #28, implementation commit `77b631f2b011c6ce8603e5de5aef12202f7f4d22`; product-certified head `2f8e7c410123386011bf94fbaeb8e147bec92953` | Implementation tree `9f9ef73811a5c04ea30cd017fcb07b57ead75e3c`; certified tree `03f5b445ff2c7f88daae8e247d23ddf01c77ce45`; not merged | 421/421 across 41 suites; 47/47 Playwright; supplemental public audit 143 crown tests across 11 suites | Exact-head private rerun: corpus v0.3 integrity 23/23; registration 91/91; preparation 4/4; crown robustness 4/4; supplemental PR #28 invariants 3/3; 24 margin and 145 intaglio vertices exact at `0 mm`; source immutable; four formats pass at `8.738665739279973e-7 mm`; persistence/recovery and privacy pass | CI `31850602483`; Runtime `31850602478`; Sprint `31850602487`; all pass on `2f8e7c4` | Public and private final gate passed. PR #28 is eligible for final architectural merge approval, remains Draft/unmerged, and Sprint 26 remains blocked. |

### Corrective certification trace

- Product head `77b631f` and first continuity head `46a3e03` each passed CI but failed Runtime/Sprint at 45/46 Playwright tests. The symmetric `±4.51 mm` posterior fixture could not satisfy distal contact without moving the locked margin; preserving it as a supposed success case would have recreated the defect.
- Test head `a37418d` passed CI and all 421 deterministic tests. Runtime `31849326554` and Sprint `31849326581` reached 46/47 Playwright tests; the new fail-closed case correctly produced `QC_FAILED`, while its assertion incorrectly expected the earlier `QC_REQUIRED` state.
- Certification-test head `05eea8a` asserts the real terminal state plus disabled approval/export. All three workflows passed, including 421/421 deterministic and 47/47 Playwright tests. This was an assertion correction, not a product, geometry, threshold, or acceptance-bound change.
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
