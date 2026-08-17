# Engineering Guardrails

These rules are permanent program gates.

## Product truth

- No placeholders may be represented as production functionality.
- No visible production tool may be inactive.
- No mocked, decorative, or fixture-only geometry may be represented as real geometry.
- Never fabricate success, evidence, measurements, provenance, support, or certification.
- Unsupported, ambiguous, missing-evidence, invalid, or unsafe behavior fails closed.
- Clinical accuracy claims require appropriate owner-attested or otherwise governed ground truth.
- Every supported technician workflow must be finishable with the available CAD tools.

## Geometry and data safety

- Source scans and upstream artifacts are immutable. Commands create versioned derived artifacts.
- Private STL or other protected source geometry never enters public git, builds, logs, reports, or artifacts.
- Destructive edits require command history, undo/redo, persistence, recovery, and immutable lineage.
- Locks and masks are functional constraints. A tool may not silently violate them to reach a target.
- A failed or infeasible geometry operation must not commit partial geometry or report convergence.

## Coverage and certification

- The Tool Coverage Registry must match runtime reality, direct tests, browser evidence where applicable, and fail-closed behavior.
- Tests, thresholds, fixtures, or acceptance bounds may not be weakened merely to obtain a pass.
- Every certification claim is bound to one immutable commit/tree and named workflow run IDs.
- A code change invalidates prior exact-head evidence until the new head is recertified.
- Private-corpus certification is claimed only when that exact head was run against the protected, integrity-verified corpus.
- Product source commits and later continuity/documentation commits are reported separately.
- No next sprint begins until the current sprint gate is satisfied and architecture explicitly authorizes it.

## Continuity-state semantics

- `PRODUCT_CERTIFIED_HEAD` is the immutable product-certification anchor: the exact product commit/tree to which certification evidence is bound.
- `LAST_REPOSITORY_HEAD_VERIFIED` is the `main` HEAD inspected before the current continuity update. It is a checkpoint, not a self-referential requirement that the continuity file contain its own eventual commit SHA.
- A future session must **not** stop automatically merely because `main` is ahead of `LAST_REPOSITORY_HEAD_VERIFIED`. It must compare the delta first.
- If the delta contains only continuity documentation, architecture documentation, roadmap documentation, certification-ledger documentation, or other clearly non-product documentation, and `PRODUCT_CERTIFIED_HEAD` remains unchanged, the session may reconcile the documentation state and continue.
- STOP is required for any unexpected delta containing product source, runtime behavior, tests affecting certification, database/schema/migrations, security/auth behavior, geometry, workflow behavior, unknown or unclassified changes, or an unexpected PR/merge state.
- Product certification must remain distinct from later continuity/documentation commits. Documentation state may advance without rewriting certification anchors or creating a self-referential SHA loop.

## Session continuity protocol

### Start of every new chat

Read, in order:

1. `docs/engineering/continuity/CURRENT_STATE.md`
2. `docs/engineering/continuity/SESSION_HANDOFF.md`
3. `docs/engineering/continuity/ENGINEERING_GUARDRAILS.md`

Then verify the recorded branch, PR, commit, tree, and workflow state against GitHub. If a recorded repository head differs from `main`, classify the delta using the continuity-state semantics above before deciding whether to stop.

### Checkpoints

- Never leave a large implementation only in conversation memory or as an entire uncommitted sprint.
- After a significant phase, commit and push durable work; update current state when authority or blockers change.
- If context becomes long, update the handoff proactively and tell the user it is safe to continue in a new chat.

### Session end

Before an intentional stop, update `CURRENT_STATE.md` and `SESSION_HANDOFF.md` with the exact certified head, the last repository head verified before that continuity update, and the sole authorized next action. Do not attempt to make a continuity file contain its own final commit SHA.

### Source of truth

Chat history is not authoritative. Git objects, GitHub PR/workflow evidence, the machine-readable compliance matrix, and these continuity ledgers are authoritative.

## Current explicit freeze

- Sprint 25 is fully reconciled, certified, and merged.
- CF-1 is the next authorized product implementation.
- Sprint 26 remains planned and must not begin before the currently authorized sequencing permits it.
- Documentation-only continuity repairs do not require private-corpus reruns when the certified CAD geometry paths are unchanged.
