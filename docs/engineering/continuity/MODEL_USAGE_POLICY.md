# Model Usage Policy

This policy governs model selection for CADence NorthStar engineering and continuity work.

## LUNA

Use LUNA for:

- continuity and repository-state reconciliation;
- documentation, roadmaps, status matrices, handoffs, and straightforward configuration;
- simple investigation where the evidence and edit scope are clear;
- compact status reporting and checkpoint preparation.

## TERRA

Use TERRA as the default for:

- ordinary implementation;
- normal debugging;
- targeted test repair;
- API/UI work whose boundaries are already established;
- routine refactoring only when explicitly authorized.

## SOL

Use SOL only for:

- difficult geometry or mathematical reasoning;
- architecture decisions with material cross-system consequences;
- a proven TERRA failure on a bounded task;
- high-risk technical review where a stronger reasoning pass is justified.

## Operating rules

- Fast mode is off unless explicitly authorized.
- Use the smallest model that can safely complete the authorized task.
- Do not use model selection to bypass repository gates, review, privacy, or human-QC requirements.
- Prefer exact repository evidence over conversational memory.
- Keep returns compact and report exact commit, tree, workflow, and test identifiers.
- Checkpoint and commit/push before context limits.
- Do not repeat full project history when a continuity file already records it.
- Stop when the authorized scope is complete; do not begin the next sprint automatically.
- Never convert planned, unsupported, or research-only work into an implemented claim.

## Current recommendation

For the next action—reviewing live PR #29, merging only after approval, and validating merged-main—use LUNA for continuity and status work. Use TERRA for any later narrow implementation/debugging. Escalate to SOL only for difficult geometry/math/architecture or a demonstrated TERRA failure.
