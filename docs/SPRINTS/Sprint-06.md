# Sprint 06 — Quality Control Engine

## Status

Implementation complete; validation pending on the Sprint 6 pull request.

## Objective

Deliver authenticated, template-driven final quality control with auditable digital sign-off, categorized defects, photographic evidence, history, and measurable quality outcomes.

## Scope

- Configurable QC templates by restoration type.
- Configurable required and optional checklist items.
- Outcomes: Pass, Rework, Hold, Remake, and Doctor Clarification.
- Categorized defects with minor, major, or critical severity.
- QC photo attachments.
- Digital inspector sign-off with identity and timestamp.
- Immutable-style in-process QC history entries.
- Case-status synchronization after QC.
- Pass rate, rework rate, remake rate, first-pass yield, outcome counts, and defect trends.
- QC API endpoints and authenticated React workspace.
- Full Playwright QC lifecycle coverage.

## Acceptance gates

- [ ] Frozen-lockfile installation passes.
- [ ] TypeScript validation passes without contract weakening.
- [ ] Production build passes.
- [ ] API gateway, upstream API, and frontend start successfully.
- [ ] Template creation and update validation pass.
- [ ] Restoration-to-template compatibility validation passes.
- [ ] Required checklist enforcement passes.
- [ ] Failed checklist items require categorized defects.
- [ ] Passing outcomes cannot contain failed checklist items.
- [ ] Digital sign-off captures inspector and timestamp.
- [ ] Photo attachment and QC history pass.
- [ ] Case status synchronizes with QC outcome.
- [ ] Pass, remake, rework, first-pass-yield, and defect-trend metrics pass.
- [ ] Authentication and Sprint 3–5 browser regressions pass.
- [ ] Sprint 6 Playwright lifecycle passes.

## Persistence note

Sprint 6 intentionally retains in-memory templates, inspections, photos, defects, sign-offs, and history. Future migration must use transactional QC inspection tables, template-version tables, immutable history events, indexed outcome/defect dimensions, durable encrypted object storage, malware scanning, retention controls, and audit-safe inspector identity references.

## Out of scope

- Durable database persistence.
- Durable encrypted photo storage.
- Production identity provider changes.
- Automated doctor notifications.
- Automated remake billing or vendor-charge workflows.
