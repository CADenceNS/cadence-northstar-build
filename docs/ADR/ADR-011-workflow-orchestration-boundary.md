# ADR-011 — Workflow Engine Coordinates but Does Not Own ERP Domains

## Status
Accepted for architecture; implementation deferred.

## Decision
The Workflow Engine will own versioned templates, runtime state, transitions, assignments, queue projections, SLA policies, timers, and orchestration history. Domain services remain authoritative for clinical, production, QC, billing, shipping, communications, and file invariants. Workflow transitions invoke domain commands and persist outbox events; they do not directly update domain tables.

## Consequences
Published templates are immutable. Instances are revisioned and use optimistic concurrency. Queues are rebuildable projections. Async production execution requires a transactional outbox, idempotent consumers, retry policy, and dead-letter review. AI may propose actions but cannot bypass approved transition policy or authorization.