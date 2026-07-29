# Sprint 11 — Clinical Communications Platform

## Status

Complete. The Clinical Communications Platform, browser contract, and PR #13 architectural hardening passed all required validation without weakening Sprint 10 identity, authorization, sessions, CSRF, persistence, or immutable audit behavior.

## Objective

Create one durable, chronological, entity-authorized communication history for Practices, Doctors, patients, cases, shipments, and invoices.

## Implemented

- Append-only PostgreSQL communication threads and events.
- Database trigger preventing event update or deletion.
- Version references for appended corrections.
- Tenant- and entity-consistent thread constraints.
- Centralized `EntityAccessService` for all communication reads, writes, search, attachments, and notifications.
- Practice authorization, Doctor ownership, applicable location scope, read/write mode, and administrative override evaluation.
- Existing ObjectStorage association without duplicated bytes.
- Safe public attachment metadata with no internal provider, bucket, or object key.
- Active same-tenant notification-recipient and entity-access validation.
- Minimized immutable security audit events for communication mutations without copied clinical content.
- In-application notifications, timeline search, entity-bound threads, and chronological display.
- React timelines in Practice, Doctor, patient, case, shipment, and invoice views.
- `docs/COMMUNICATIONS.md` and `docs/ADR/ADR-005-communications-operational-history.md`.

## PR #13 review root causes

1. Initial communication authorization was tenant-scoped but did not resolve Practice or entity ownership.
2. Caller-provided thread IDs were not validated against tenant and entity identity.
3. Attachment responses exposed internal ObjectStorage keys.
4. Notification recipients were not validated against tenant membership and entity access.
5. Authorization tests did not cover same-tenant cross-Practice denial and related association failures.
6. Sprint documentation referenced an older validated commit.
7. Operational communication history and security-audit participation required a more explicit boundary.
8. The permanent Communications domain lacked an ADR.

## Architectural review resolution

- Every endpoint uses one entity-access service; route-specific authorization duplication is prohibited.
- The resolver uses NorthStar's active `repository_documents` abstraction first and normalized PostgreSQL ownership tables as a compatibility fallback.
- Composite PostgreSQL constraints and application checks require thread tenant, entity type, and entity ID consistency.
- Search and notification retrieval are filtered through entity authorization.
- Existing-object association validates the object's owning entity before linking.
- Notification recipients must be active tenant members authorized for the entity.
- Security audit records contain operation and non-clinical identifiers/counts only.
- ADR-005 records the operational-history, append-only, authorization, audit-separation, and non-chat decisions.

## Final validated evidence

Final documentation head prior to this evidence-only update, `2053baa8cfe7c84e596348ad09b6ee6d7923878a`, passed:

- Sprint 11 Validation run `30432889764`.
- Runtime Validation run `30432889796`.
- Frozen dependency and reproducible installation.
- Strict TypeScript and production builds.
- Migrations 0001–0004.
- Inherited persistence and Sprint 10 security contracts.
- Hardened communications integration tests.
- Same-tenant, different-Practice denial.
- Cross-tenant and mismatched-thread rejection.
- Unauthorized event and object-association denial.
- Authorized-Practice search filtering.
- Invalid-recipient rejection.
- Safe attachment response metadata.
- Immutable operational history and minimized security audit evidence.
- Migration 0004 rollback and reapplication.
- Secure API and frontend startup.
- Complete inherited and Sprint 11 Playwright regressions.

The exact final commit containing this closeout must retain the same successful validation gates before merge.

## Definition of Done

- [x] Centralized entity authorization is used across all Communications endpoints.
- [x] Thread associations are tenant- and entity-consistent.
- [x] Internal ObjectStorage keys are not exposed.
- [x] Notification recipients are validated.
- [x] Authorization, attachment, notification, thread, search, audit, and browser tests pass.
- [x] Operational history and security audit remain separate.
- [x] Communications ADR is complete.
- [x] Runtime Validation passes.
- [x] Complete Playwright regression passes.
- [x] Documentation references current validated evidence.

## Deferred

- Email, SMS, and push notification providers.
- Real-time websocket chat, presence, and typing indicators.
- External Doctor Portal and Patient Portal communication policies.
- Mentions, escalation rules, and notification preferences.
- Rich-text editing and third-party email ingestion.
- Retention automation, legal holds, and records exports.
- Authorized download endpoints and short-lived provider URLs.
