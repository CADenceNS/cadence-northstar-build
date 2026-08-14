# Sprint History and Reconciliation Record

## Recent progression

| Milestone | Repository event | Architectural result |
|---|---|---|
| Sprint 22 / 22A | PR #22 merged as `eaed7d14b677987c73c035a08fecaeacae7d71b7` | Production scan registration, bite-evidence assembly, dental coordinates, support classification, persistence/recovery, protected-corpus harness. |
| Sprint 23 / 23A | PR #23 merged as `ec21d4fa62821736fce80db20502cb828b551eb0` | Universal versioned geometry editing core, exact intersection evidence, projected closed trimming, 84-tool registry. |
| Sprint 24 | PR #24 merged as `0465e049980415d41b8e28ff6d019a202c7f3de1` | Preparation/margin intelligence, draw/QC, immutable lineage, multi-preparation workflows, 138-tool universal registry. |
| CI preservation repair | PR #26 merged as `82c24a9cb183a35cf048f86e9ba892b8d08bac08` | Repaired a legacy zero-job workflow without product behavior changes; became PR #27 base. |
| Sprint 25 stale draft | PR #25 closed unmerged | Candidate body is historical only; current metadata has no distinct changes and is not certification evidence. |
| Sprint 25A | PR #27 commit `72add66b8479f417ef1331a12f87990149d907b6` | Initial production single-crown system; previously certified checkpoint, incomplete against the later reconstructed 712-row specification. |
| Sprint 25B | PR #27 commit `234eccebb474f57dad3d71f325ad4c79475533f6` | The specification audit and gap closure were real. The exact commit was not certified because Runtime and Sprint workflows failed. |
| Sprint 25 stabilization (“25C” forensic label only) | PR #27 commits `0bc4ba1`…`6bbffdb` | Browser fixture/evidence hardening and three optimizer fixes produced green public workflows. No repository artifact explicitly names this Sprint 25C. |
| Sprint 25 merge | PR #27 merged as `b53cdd86c2e4eb61e1931c816c34703aa8614823` | Merged tree passed public workflows, but post-merge reconciliation found a silent margin-lock violation in the final commit. |
| Sprint 25 corrective reconciliation | Draft PR #28; product-test head `05eea8a` | Restores non-margin proximal correction; proves feasible convergence and infeasible fail-closed behavior; updates registry/ledgers. Public gates pass; architectural review remains. Sprint 26 remains blocked. |

## Six-commit delta from Sprint 25A to PR #27 final head

Base: `72add66b8479f417ef1331a12f87990149d907b6`, tree `67657872fa82970364ac61626172f8976741d403`  
Head: `6bbffdb9f494aee642d39f3503db533cbf458350`, tree `e9a8470c70708a411d410cfd1c3d7a4793da5eac`

| Commit (UTC) | Classification | Files / direct change | Runtime and test implication |
|---|---|---|---|
| `234eccebb474f57dad3d71f325ad4c79475533f6` — 2026-08-13T20:16:33Z | `SPRINT_25B_COMPLIANCE` | 30 files, +1,764/−220. Added `crown-anatomy.ts`, `tooth-numbering.ts`, compliance matrix and multiple test suites; changed workspace, analysis, engine, export, geometry, overlays, QC, registry, morphology, commands/state/types, private and browser tests. | Real gap closure: seven materials, full morphology/tool/lock/contour/joint-optimizer/history/export coverage, 81 crown tools, 15 failure cases, 712-row audit. CI passed; Runtime/Sprint failed at this head. |
| `0bc4ba18cf2cdcbcff9844db7e2d3c1555a151cc` — 2026-08-13T20:34:30Z | `TEST_ONLY`, `CERTIFICATION_SUPPORT` | 1 browser file, +2/−2. Replaced auto-axis fixture interaction with numeric axis input and corrected arch fixture face winding. | Made the browser fixture deterministic/valid; no product runtime change. |
| `0bd37d98f8cca355770a3c17044a96a8d7ad524d` — 2026-08-13T20:46:26Z | `TEST_ONLY`, `CERTIFICATION_SUPPORT` | 1 browser file, +2/−2. Tightened optimizer and QC selectors to persisted evidence. | Proved durable operator evidence rather than a loose visible label; no runtime change. |
| `d4cd755b7320f1e06d7c5e80aaa2810aac4a547b` — 2026-08-13T21:09:45Z | `BUG_FIX` | `crown-analysis.ts` and QC test, +33/−7. | Recomputed analyses and skipped contact/occlusion displacement already inside governed material ranges; regression prevents re-displacement of satisfied constraints. |
| `7ff156f6f3c4b829061c9bd4f40c88c8d58a3601` — 2026-08-13T21:31:34Z | `BUG_FIX` | Same 2 files, +10/−3. Increased proximal support from nearest 8% to 20%. | Large bounded proximal corrections converge without foldover/self-intersection in the added regression. |
| `6bbffdb9f494aee642d39f3503db533cbf458350` — 2026-08-13T22:14:40Z | `BUG_FIX` with post-merge compliance defect | Same 2 files, +21/−4. Changed eligible proximal vertices from non-margin support to all outer vertices; added tilted-axis regression. | Resolved the fixture's measured-domain stall and produced public green runs, but the test checked intaglio/preparation—not crown margin. The solver could move an actively locked approved margin. |

No material profile, persistence schema, or unrelated NorthStar business change occurred in the final five hardening commits after `234ecce`.

## Final proximal-fix forensics

The original issue was a measurement/edit-domain mismatch on a tilted-axis posterior fixture. Analysis measured all outer-surface distances, while the optimizer edited only non-margin support. The final PR #27 commit made the domains identical by admitting all outer vertices.

That mathematical change was too broad. `optimizeProximalContact` accepts only the side contact lock; `CrownWorkspace` and the joint optimizer do not pass `locks.margin` into it. Consequently, all-outer eligibility bypassed the explicit margin workflow. Against exact merged code, the optimizer reported convergence after moving 32 of 48 margin vertices by as much as `0.7500000000000004 mm`.

PR #28 restores the correct command boundary: analysis may still observe full outer-surface proximity, but contact correction can modify only non-margin proximal support. A feasible tilted-axis posterior case (`mesial -4.79 mm`, `distal +3.75 mm`) proves mesial/distal/occlusal pass, convergence, zero self-intersections, unchanged approved margin, unchanged intaglio, and unchanged preparation source.

The original symmetric `±4.51 mm` fixture is retained as a separate infeasible regression. Expanding non-margin support far enough to force its target produces real foldover/self-intersection; the merged all-outer implementation reached the target only by moving the approved margin. The corrected implementation therefore reports `best-effort` with an explicit distal constraint violation, produces hard QC `FAIL` / restoration `QC_FAILED`, disables approval and export, preserves valid topology, and leaves margin, intaglio, and preparation exact. This is fail-closed evidence, not a relaxed threshold.

Certification-test head `05eea8a` passed 421/421 deterministic tests across 41 suites and 47/47 Playwright tests in CI `31849913854`, Runtime `31849913798`, and Sprint `31849913825`. The protected corpus was unavailable and was not claimed as rerun.

## Durable architectural decisions

- Registration, preparation, and restoration work never mutates source scans.
- Editing commands own immutable derived geometry, history, persistence, and recovery.
- Tool registries are executable coverage contracts, not catalogs of intent.
- Material behavior is profile-governed and explicitly non-clinical unless separate evidence authorizes a claim.
- Geometry success requires measured valid output; a lock cannot be traded for convergence.
- A green workflow does not overrule a disproven requirement; corrective code requires a new exact-head certification.
- Sprint labels inferred during reconciliation are marked as inference. Repository artifacts remain the authority.
