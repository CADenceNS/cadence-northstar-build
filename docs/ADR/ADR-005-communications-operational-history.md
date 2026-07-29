# ADR-005 — Communications as the Operational History Domain

- Status: Accepted
- Date: 2026-07-29
- Owners: NorthStar Architecture and Engineering

## Context

NorthStar requires one chronological, durable record of operational communication across Practices, Doctors, patients, cases, shipments, and invoices. This record includes calls, emails, notes, clinical collaboration, production updates, QC comments, shipping and billing events, attachments, notifications, and system-generated activity.

Security audit records have a different purpose: they establish authenticated security and change evidence without copying clinical or operational content. A conventional chat model would also be inappropriate because laboratory communications must remain attached to operational entities, durable, searchable, and reviewable after a case or financial workflow is complete.

## Decision

1. Clinical Communications is the permanent operational-history domain for supported NorthStar entities.
2. Communication events are append-only. Corrections create a new event referencing the prior event through `version_of`; existing content is never silently overwritten.
3. Threads are entity-bound. A thread and every event within it must share tenant, entity type, and entity ID. PostgreSQL composite constraints and application validation enforce this relationship.
4. Every read, search, thread, event, attachment, and notification operation passes through the centralized entity-access authorization service. Authorization evaluates tenant, Practice scope, Doctor ownership, applicable location scope, read/write mode, and administrative override.
5. Attachments reuse ObjectStorage and expose only safe public metadata. Internal provider, bucket, and object-key details are not public API fields.
6. Notification recipients must be active members of the same tenant and authorized to read the related entity.
7. Communication mutations append minimized immutable security audit events containing actor, operation, entity, result context, and non-clinical counts or identifiers. Full communication content remains only in operational history.
8. Communications is not a chat system. Real-time presence, typing indicators, ephemeral messages, and websocket chat semantics are outside this domain.

## Consequences

- The laboratory receives a complete operational record without competing histories in individual modules.
- Entity authorization cannot be implemented independently in each route.
- Search results must be filtered by the caller's authorized entity scope.
- Corrections increase history rather than rewriting it.
- Security audits and operational communications remain separate but linkable by actor, entity, and timestamp.
- Future portals must use the same entity-access service and cannot bypass Practice or Doctor ownership rules.

## Alternatives rejected

- Mutable notes attached independently to each ERP module: rejected because history can be overwritten and search becomes fragmented.
- Security audit as the communication record: rejected because security evidence should not duplicate clinical content.
- General-purpose chat: rejected because it lacks durable entity ownership and laboratory workflow semantics.

## Validation

Validation requires migration apply/rollback/reapplication, append-only database tests, entity-scope authorization tests, thread-association tests, ObjectStorage metadata tests, notification-recipient tests, search-filtering tests, Runtime Validation, and complete Playwright regressions.
