# Sprint 11 — Clinical Communications Platform

## Status

Complete. The Clinical Communications Platform and the aligned browser contract passed Sprint 11 Validation, Runtime Validation, all integration gates, migration rollback/reapplication, and the complete Playwright regression suite.

## Objective

Create one durable, chronological, tenant-aware communication history for practices, doctors, patients, cases, shipments, and invoices without weakening Sprint 10 authentication, authorization, session, CSRF, or audit controls.

## Implemented

- Append-only PostgreSQL communication threads and events.
- Database trigger preventing event update or deletion.
- Version references for appended corrections.
- Tenant-aware attachment associations to existing ObjectStorage records.
- New communication file uploads routed through ObjectStorage.
- In-application notifications with recipient, priority, category, unread state, and read transitions.
- Timeline retrieval ordered chronologically.
- Thread creation and thread-history retrieval.
- Search by entity, actor, event type, date, and keyword.
- Secure communication APIs behind the Sprint 10 security gateway.
- Read-only auditor denial for communication creation.
- Reusable React timeline integrated into Practice, Doctor, Patient, Case, Shipment, and Invoice views.
- Authenticated notification center.
- Communication integration and Playwright tests.
- Dedicated Sprint 11 CI workflow and Runtime Validation migration support.
- `docs/COMMUNICATIONS.md`.

## Communication categories

- Phone call
- Email
- Internal note
- Doctor message
- Laboratory message
- Production update
- QC comment
- Shipping event
- Billing event
- Attachment
- System event

## Audit separation

Operational communication is stored in `communication_events`. Security audit evidence remains in `audit_events`. The existing gateway records authenticated mutation context without copying full clinical communication content into the security log.

## Sprint 11A root cause

The inherited Sprint 3 Practice and Doctor regression still expected the retired `Communication note` field and `Add communication` button. Those controls were replaced by the production `CommunicationTimeline` during Sprint 11. The initial aligned test also used a partial accessible-name selector that matched the communication type selector, textbox, attachment input, and timeline region; Playwright correctly rejected that ambiguous selector.

No production communication defect was discovered.

## Browser contract evolution

The application implementation is the source of truth. Browser validation now exercises the permanent communication contract:

1. Expand the entity Communication Timeline.
2. Select a communication event type.
3. Enter content in the exact communication textbox.
4. Submit through `POST /api/communications/events`.
5. Require HTTP 201.
6. Verify chronological display of multiple events.
7. Refresh the application and restore the authenticated server session.
8. Reopen the entity timeline and verify durable event persistence and ordering.

The inherited CRUD lifecycle remains covered. Dedicated Sprint 11 browser and integration tests continue to cover Practice timeline persistence, notification retrieval, ObjectStorage attachment linking, search, authorization, immutable event storage, and audit participation.

## Updated Playwright assumptions

- Legacy Practice and Doctor communication controls no longer exist and must not be queried.
- `CommunicationTimeline` is the only supported browser communication surface.
- Accessible selectors use exact roles and names where labels share a prefix.
- Browser tests assert protected API status codes so authorization, CSRF, or persistence failures cannot be hidden by UI timing.
- Refresh validation relies on the HttpOnly server session established by Sprint 10, not localStorage authentication state.

## Verified

Implementation head `d196be576cbed0e89c2852bcaaecbbc711ca1c74` passed:

- Sprint 11 Validation run `30313005134`.
- Runtime Validation run `30313005220`.
- Frozen dependency installation and reproducible installation.
- Strict TypeScript and production builds.
- Migrations 0001–0004.
- Inherited persistence and security contracts.
- Communications repository and API integrations.
- Timeline ordering, thread history, attachment linking, search, notification, authorization, immutability, and audit-separation tests.
- Migration 0004 rollback and reapplication.
- Secure API and frontend startup.
- Complete inherited Playwright regressions.
- Sprint 11 communication and notification browser scenarios.

## Definition of Done

- [x] Frozen-lockfile installation passes on final implementation head.
- [x] Strict TypeScript passes.
- [x] Production build passes.
- [x] Migration 0004 applies, rolls back, and reapplies.
- [x] Communication integration tests pass.
- [x] Timeline ordering tests pass.
- [x] Thread-history tests pass.
- [x] Attachment linking and ObjectStorage tests pass.
- [x] Search tests pass.
- [x] Notification read/unread tests pass.
- [x] Authorization tests pass.
- [x] Runtime Validation passes.
- [x] Existing Playwright regressions pass.
- [x] Communication browser scenarios pass.
- [x] `CommunicationTimeline` replaces legacy communication controls in browser validation.
- [x] Existing ERP functionality remains unchanged.
- [x] No production communication or Sprint 10 security control was weakened.
- [x] Final documentation distinguishes implemented, verified, and deferred work.

## Deferred

- Email, SMS, and push notification providers.
- Real-time websocket chat, presence, and typing indicators.
- External Doctor Portal and Patient Portal communication policies.
- Mentions, escalation rules, and notification preferences.
- Rich-text editing and third-party email ingestion.
- Retention automation, legal holds, and records exports.

## Completion rule

Sprint 11 is complete only while the final documentation head retains successful Sprint 11 Validation and Runtime Validation results. PR #13 may move out of draft after those final-head checks pass. No Sprint 10 security control may be bypassed or weakened.
