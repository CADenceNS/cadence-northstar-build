# Workflow Engine Architecture

## Purpose

Define a configurable, tenant-isolated orchestration engine for laboratory workflows without implementing runtime behavior.

## Domain boundary

The Workflow Engine owns versioned templates, states, transitions, assignments, queue projections, SLA policies, timers, approvals and orchestration history. It does not own cases, prescriptions, products, production records, QC inspections, shipments, invoices, communications, users, files, branding, licensing or tax records.

Each workflow instance belongs to exactly one laboratory tenant and references one authoritative domain aggregate. Domain services remain authoritative and may reject a command even when a template allows a transition.

## Domain model

- `workflow_template`: tenant, aggregate type, name, status and active version.
- `workflow_template_version`: immutable published definition.
- `workflow_state_definition`: stable key, category, terminal flag and presentation metadata.
- `workflow_transition_definition`: from/to, domain command, guards, permissions and approval policy.
- `workflow_instance`: tenant, template version, aggregate reference, state, revision and status.
- `workflow_transition`: append-only requested/completed/rejected evidence.
- `workflow_assignment`: user/team/department and effective period.
- `workflow_queue_projection`: rebuildable tenant-scoped work-discovery read model.
- `workflow_sla_policy`: calendar, start/stop/pause events, target and escalation thresholds.
- `workflow_timer`: due time, action/event, lease, retry and dead-letter state.
- `workflow_approval`: policy, approver, decision and immutable evidence.

## Illustrative state model

```text
Submission Received
→ Prescription Required
→ Clinical Validation
→ Routing / Product Resolution
→ Accepted
→ Production
↔ Rework / Hold / Doctor Clarification
→ Quality Control
→ Billing Review
→ Ready to Ship
→ Shipped
→ Delivered
```

This is an example template, not a universal hard-coded route. Each laboratory may publish approved tenant templates. Existing instances remain pinned to the immutable template version unless an authorized migration explicitly moves them.

## Transition processing

1. authenticate actor and resolve laboratory tenant;
2. verify aggregate and Practice/entity authorization;
3. verify tenant licensing/configuration prerequisites without treating them as permissions;
4. compare expected instance revision;
5. evaluate transition, guards and SLA policy version;
6. collect required approvals;
7. invoke the owning domain command;
8. persist transition and outbox event atomically;
9. rebuild/update queue projection idempotently;
10. append configured Communications event and separate security audit.

Stale revisions fail with conflict. Domain-command failure leaves workflow state unchanged.

## Event model

Versioned events include instance created/completed, transition requested/completed/rejected, assignment changed, approval recorded, SLA warning/breach and timer dead-lettered. Payloads contain tenant and identifiers plus minimal routing metadata—not full clinical or financial documents. Consumers are idempotent and production asynchronous use requires a transactional outbox.

## Queue model

Queues are projections by tenant, department, role, assignment, location, priority, due time, restoration type and authorization scope. Claim, assign, release, prioritize and bulk operations independently verify each underlying aggregate. A queue outage never changes source workflow state and projections can rebuild from transition history.

Role-specific examples:

- Customer Service intake exceptions;
- CAD design queue;
- Production department queues;
- QC inspection and rework queues;
- Shipping readiness queue;
- Accounting Billing Review queue;
- Management SLA and escalation queue.

## SLA model

SLA policies use tenant business calendars, holidays, pause reasons, warning thresholds and escalation destinations. Historical calculations retain the exact policy version. A breach emits events and notifications; it does not silently alter clinical, billing or shipping outcomes.

## Approval model

Policies support all-of, any-of, ordered and threshold approvals. Separation of duties can prohibit self-approval. Decisions are immutable; corrections create linked records. Approval authority is tenant/role scoped.

## Failure, scale and isolation

- tenant identity is mandatory on instances, transitions, queues, timers and events;
- scheduler leases and partitions prevent duplicate timer execution;
- one tenant’s queue backlog cannot starve other tenants;
- per-tenant quotas and fair scheduling protect commercial scalability;
- outbox retries do not repeat committed transitions;
- projection failures rebuild from append-only history;
- dead letters remain tenant-scoped and auditable;
- cross-domain compensation is explicit, never a hidden distributed database rollback.

## Integration points

Digital Intake creates initial instances after acceptance prerequisites. Production, QC, Billing and Shipping commands determine operational success. Communications receives configured events. Licensing and feature flags may enable template availability, but authorization and domain invariants remain independent. Tenant Customization Studio may manage draft templates and SLA policies; Platform Owner cannot alter tenant workflow definitions without an explicit support grant.

## AI and automation

Future automation may recommend routing, transitions, priority or SLA risk. Automated execution requires an approved tenant policy and records model/version, evidence, confidence, policy and human override. High-risk clinical or financial actions require human approval unless separately governed.

## Deferred

All migrations, repositories, APIs, UI, timers, outbox, projections, workflow template administration and runtime execution remain deferred.