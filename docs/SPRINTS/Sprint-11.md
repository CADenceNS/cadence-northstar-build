# Sprint 11 — Clinical Communications Platform

## Status

In progress. Implementation is present on the Sprint 11 feature branch. The sprint remains incomplete until Sprint 11 Validation, Runtime Validation, integration tests, migration rollback/reapplication, and the complete Playwright regression suite pass on the final head.

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

## Acceptance gates

- [ ] Frozen-lockfile installation passes on final head.
- [ ] Strict TypeScript passes on final head.
- [ ] Production build passes on final head.
- [ ] Migration 0004 applies, rolls back, and reapplies.
- [ ] Communication integration tests pass.
- [ ] Timeline ordering tests pass.
- [ ] Thread-history tests pass.
- [ ] Attachment linking and ObjectStorage tests pass.
- [ ] Search tests pass.
- [ ] Notification read/unread tests pass.
- [ ] Authorization tests pass.
- [ ] Runtime Validation passes.
- [ ] Existing Playwright regressions pass.
- [ ] Communication browser scenarios pass.
- [ ] Final documentation distinguishes implemented, verified, and deferred work.

## Deferred

- Email, SMS, and push notification providers.
- Real-time websocket chat, presence, and typing indicators.
- External Doctor Portal and Patient Portal communication policies.
- Mentions, escalation rules, and notification preferences.
- Rich-text editing and third-party email ingestion.
- Retention automation, legal holds, and records exports.

## Completion rule

Do not mark Sprint 11 complete or move PR #13 out of draft until every acceptance gate passes on the final head. No Sprint 10 security control may be bypassed or weakened.
