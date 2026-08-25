Warning: truncated output (original token count: 4688)
Total output lines: 122

# Certification Ledger

## CF-1A3B Platform Admin Commercial Management UI

- Status: **CERTIFIED AND MERGED** via PR #37. Main merge commit: `e03f85144f31533e8785588c5cf1514a92184ab1`; merged-main tree: `e30b3b43f74f4b32cbe729ef8188aaa5d596fb6e`.
- Certified product head: `0535e8c433226c167cca85ffefd83d50ee1d57db`; product tree: `2b72dce8956e940d93e6513567d19039c1609e8c`.
- Exact-head evidence: CI #620 PASS; Runtime Validation #385 PASS; Sprint 13A Validation #279 PASS; Runtime/Sprint Playwright 51/51.
- Scope: Platform Admin-only lab directory and detail, activation issue/revoke/rotate with one-time secret display and clearing, server-backed entitlement and independent seat controls, lifecycle controls, commercial audit history, and tenant operational-data boundary.
- Regression evidence: migrations through 0010, tenant-native security, CF-1A2 entitlement/seat, and CF-1A3A activation/licensing regressions PASS. Commercial UI fixtures provision and mutate unique tenants, preserving shared test-state isolation.
- Explicit non-claims: subscription billing, GVM functionality, and white-labeling are not complete; GVM remains entitlement registration only. No CAD geometry changed and no private dental corpus was run.
- Authorized next action: **VIS-1 — CADence NorthStar Owner Preview Deployment.** Recommended model: **GPT-5.6 Terra**. Do not configure `preview.cadencenorthstar.com` during this merge task.

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
| Sprint 24 | PR #24, `4ee517a71dde834a4d31976c9d5a1dbd8797b00f` | Tree `2b34e58367bd53d1e51f7bd0247713d5216720de`; merged as `0465e049980415d41b8e28ff6d019a202c7f3de1` | 278/278; 44/44 Playwright; 138/138 production tools | Historical PR evi…688 tokens truncated…`31749154678`, Runtime `31749154663`, Sprint `31749154682`; post-merge: CI `31775108836`, Runtime `31775108814`, Sprint `31775108844`; all pass | Merged 2026-08-14. Reconciliation invalidated the full-certification claim because the proximal solver silently moved a locked margin. |
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

## VIS-1B — Production Preview Runtime Readiness

- Certified runtime head: `0033ecc7363274821e81806fa6b71bfd4d2fe7cb`; tree `616a00d409cf98ff64255c8545efbcfc13a4d143`.
- Merge commit: `d2f4d3e01cfd25ec95104f8e71f7795a8e9de889`; merged-main product/runtime tree unchanged.
- Scope: compiled API start command, provider PORT handling, private loopback upstream, external ordered migrations 0001–0010, static same-origin NorthStar/Design Studio serving, environment contract, and deployment documentation.
- Merged-main evidence: CI #625 PASS; Runtime Validation #390 PASS; Sprint 13A Validation #284 PASS; complete Runtime/Sprint Playwright 51/51.
- Runtime/security evidence: API build/start/health, PORT handling, migrations, authentication/session, CSRF, origin/cookie rules, tenant isolation, Platform Admin boundary, NorthStar build, and Design Studio build PASS.
- Boundary: no deployment, DNS, private dental corpus, product feature, commercial behavior, authentication weakening, tenant-boundary weakening, or Design Studio geometry change.

## VIS-1D — Corrected owner preview shell identity

- Certified implementation head: `b87222b0888c1ac93833a2808bdd6a6ba574b76e`; product/runtime tree: `828fd6477a64810e1d32996f6672c564a8f1569a`.
- Merge commit: `ff70baa3bfbde7a928ca6b708a1de4e9b593fd69`; merged-main product/runtime tree unchanged.
- Scope: replace the active legacy Keramos/UAT/Sprint owner-facing shell labels with CADence NorthStar identity while preserving the existing server-backed Platform Admin commercial console and tenant-scoped operational routing.
- Boundaries: no API semantics, authentication, session/CSRF/cookies, tenant isolation, Platform Admin operational-data boundary, entitlements, seats, licensing, lifecycle semantics, migrations, schema, private dental corpus, or Design Studio geometry changed.
- Merged-main evidence: CI #629 PASS; Runtime Validation #394 PASS; Sprint 13A Validation #288 PASS; Runtime and Sprint complete Playwright 51/51.
- `OWNER_PREVIEW_VISUAL_ACCEPTANCE = PENDING`; next authorized action is owner visual review at `https://cadence-northstar-preview.onrender.com`. No CF-1B or Sprint 26 authorization.

## VIS-2C — Owner-approved NorthStar foundation lock

- Owner-approved product source head: `fbddd1e557ede27a2e7e51ebba0b314a2a32d284`.
- Documentation-only continuity tail: `bd897fccd808260dc6f91f3e0a977219ea6c442b`; comparison contains only seven continuity-document paths.
- PR #41 merge commit: `bb50dfc8dc344b4e2cf173620c79bc342754c85f`; resulting product/runtime tree: `435117dc1bde03d0075dc1d93f9a7eaee19edcc1`.
- Scope: owner-approved v4.2-derived NorthStar operational workspace, current CADence Design Studio, Design Studio entitlement/seat correction, and Intake Administration rail restoration.
- Merged-main evidence: CI #638 PASS; Runtime Validation #403 PASS; Sprint 13A Validation #297 PASS; Runtime and Sprint complete Playwright 51/51.
- Security/runtime evidence: production builds, API health, migrations 0001–0010, authentication/session, CSRF/cookies, tenant isolation, Platform Admin boundary, entitlements/seats, Design Studio access, and Intake Administration PASS.
- `OWNER_VISUAL_ACCEPTANCE = PASS`; `NORTHSTAR_UI_FOUNDATION` is the v4.2-derived owner-approved workspace; `DESIGN_STUDIO_UI_FOUNDATION` is the current owner-approved CADence Design Studio.
- `UI_POLICY = additive only; no foundational redesign without explicit owner approval`. No private dental corpus or geometry change was made.
- Next authorized action: **PP-1A — PRODUCT CATALOG, PRICING FOUNDATION & CASE PRODUCT LINE-ITEM ARCHITECTURE**; recommended model GPT-5.6 Terra. CF-1B and Sprint 26 remain unauthorized.

### VIS-2C-R1 remote reconciliation

- `PRODUCT_CERTIFIED_HEAD`: `fbddd1e557ede27a2e7e51ebba0b314a2a32d284`.
- `REMOTE_MERGE_HEAD`: `bb50dfc8dc344b4e2cf173620c79bc342754c85f`.
- `LAST_REPOSITORY_HEAD_VERIFIED`: remote `main` `0a97ac83d860f264dcd3248134b20ce541140031`; tree `72c1abe673a3663ec2e446b83da6407aa984f078`.
- Local/remote product-source equivalence: **PASS**; remote publication and merged main preserve the owner-approved product/runtime source, with later changes limited to continuity documentation.
- Outcome: **VIS-2C = OWNER APPROVED / CERTIFIED / MERGED / REMOTE RECONCILED**; `OWNER_VISUAL_ACCEPTANCE = PASS`.

## PP-1A-F9 — final owner approval and merge

- Owner-approved product source: `35f97b54cd9480f052f3f1606d538b4fee2a5a75`.
- Product tree: `7ce5859d9bd746825ac0e4374a5ae313f15f2907`.
- PR #42 normal merge: `396b2837176bcc86187457e3403a0f91b99f8d40`.
- Resulting `origin/main` tree: `7ce5859d9bd746825ac0e4374a5ae313f15f2907`.
- Exact-head evidence: CI #672 PASS; Runtime #437 PASS; Sprint #331 PASS;
  Runtime Playwright 54/54; Sprint Playwright 54/54.
- Owner visual approval: PASS; Design Studio unchanged.
- Outcome: **PP-1A = OWNER APPROVED / CERTIFIED / MERGED**.
- PP-1B handoff is future-only and is recorded in
  `PP-1A_F9_FINAL_CERTIFICATION.md`.
