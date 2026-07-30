# Workflow Engine Architecture

## Purpose

Define a configurable orchestration engine for NorthStar without implementing runtime behavior in Sprint 13.

## Domain boundary

The Workflow Engine owns templates, states, transitions, assignments, queue projections, SLA policies, timers, and orchestration history. It does not own cases, prescriptions, products, QC inspections, shipments, invoices, communications, users, or files.

A workflow instance references a domain aggregate and coordinates allowed commands. Domain services remain authoritative and may reject a transition even when the workflow template allows it.

## Domain model

- `workflow_template`: tenant, name, aggregate type, version, status.
- `workflow_state_definition`: stable key, label, category, terminal flag.
- `workflow_transition_definition`: from/to states, command, guards, required permissions, approval policy.
- `workflow_template_version`: immutable published definition.
- `workflow_instance`: template version, aggregate reference, current state, revision, status.
- `workflow_transition`: append-only attempted/completed transition record.
- `workflow_assignment`: instance/state, user/team/department, effective period.
- `workflow_queue_projection`: read model for work discovery.
- `workflow_sla_policy`: start/stop events, target duration, warning thresholds, calendar.
- `workflow_timer`: due time, action/event, retry policy, status.
- `workflow_approval`: transition, role, approver, decision.

## State machine

```text
Created → Intake Validation → Routing Review → Accepted
                                     └→ Rejected
Accepted → Production → Quality Control
Production ↔ Rework
Quality Control → Billing Review → Ready to Ship → Shipped → Delivered
Quality Control → Hold / Doctor Clarification
```

This is an illustrative template, not a hard-coded universal workflow. Published template versions are immutable. Existing instances remain pinned unless an authorized migration plan explicitly moves them.

## Transition command

`RequestTransition` includes tenant, workflow instance, expected revision, requested transition key, actor, reason, domain command payload reference, and idempotency key.

Processing order:

1. authenticate and authorize;
2. verify tenant and aggregate access;
3. lock or compare instance revision;
4. evaluate transition definition and guards;
5. collect approvals when required;
6. invoke the owning domain command;
7. persist state transition and outbox event atomically;
8. update queue projection asynchronously;
9. append operational Communications event when configured;
10. preserve separate security audit.

Optimistic concurrency rejects stale transitions with a conflict response.

## Event model

Events use stable names and versioned payloads:

- `workflow.instance.created.v1`
- `workflow.transition.requested.v1`
- `workflow.transition.completed.v1`
- `workflow.transition.rejected.v1`
- `workflow.assignment.changed.v1`
- `workflow.sla.warning.v1`
- `workflow.sla.breached.v1`
- `workflow.instance.completed.v1`

Events contain identifiers and minimal routing metadata, not full clinical documents. Consumers must be idempotent. A transactional outbox is required before asynchronous production use.

## Queue model

Queues are projections, not source-of-truth state. Queue membership may derive from state, department, assignment, priority, due time, location, restoration type, and authorization scope. Users only see items whose underlying aggregates they can access.

Queue operations:

- claim;
- assign/reassign;
- release;
- prioritize;
- filter and sort;
- bulk action only when every item independently passes authorization and transition guards.

## SLA model

An SLA policy defines business calendars, start/stop/pause events, target duration, warning thresholds, escalation destinations, and breach behavior. SLA clocks are append-only calculations with pause intervals. Historical calculations retain the policy version used.

SLA breach emits an event and notification; it does not automatically alter clinical or billing outcomes unless a template explicitly defines an approved escalation transition.

## Approval model

Transitions may require one or more approvals by role or named authority. Approval policies support all-of, any-of, ordered, and threshold rules. The requester cannot self-approve where separation of duties is required. Approval decisions are immutable; revised decisions create new records.

## Failure and compensation

- Domain command failure leaves workflow state unchanged.
- Outbox delivery failure retries without repeating the committed transition.
- Projection failure rebuilds from transition history.
- Timer execution uses leases, retry limits, and dead-letter review.
- Cross-domain compensation is explicit and never hidden as a database rollback across independent transactions.

## Integration points

- Digital Intake creates the initial workflow instance after acceptance prerequisites.
- Production and QC commands determine operational success.
- Communications receives configured operational events.
- Billing Review consumes Product Resolution but Billing owns invoices.
- Shipping transitions remain governed by shipment domain invariants.
- Feature flags and entitlements may enable templates, but authorization remains independent.

## AI and automation extensibility

Future automation may propose transitions, priorities, routing, or SLA risk. AI output is advisory unless an approved policy allows automatic execution. Every automated action identifies model/version, evidence, confidence, policy, and human override path.

## Deferred

All migrations, repositories, APIs, UI, timers, outbox, projections, and workflow execution are deferred to Sprint 13A or later after architectural approval.