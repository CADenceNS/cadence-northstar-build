# CADence NorthStar Engineering Backlog

## Governance

- Current implementation baseline: RC1 on `main` at `b05da10bb633bb48e51f08a9b10bef4a88d152a3`.
- Canonical sequencing: `docs/ROADMAP.md`.
- Canonical module status: `docs/MODULE_REGISTRY.md`.
- Canonical debt and temporary workarounds: `docs/TECHNICAL_DEBT.md`.
- No feature sprint begins until RC1 Business UAT is reviewed.

## Active — Business UAT

- [ ] Complete the Keramos RC1 business walkthrough.
- [ ] Validate every seeded role and landing experience.
- [ ] Validate case intake, production, CAD handoff, QC, shipping, Billing, Doctor and executive workflows.
- [ ] Validate tenant isolation with Sample Laboratory A.
- [ ] Record defects, enhancements, workflow observations and UI findings.
- [ ] Resolve or disposition all Critical and High defects.
- [ ] Obtain formal business-owner sign-off.

## Active — Engineering continuity governance

- [x] Merge exact certified PR #18 into `main`.
- [x] Create repository status audit.
- [x] Create Master Development Bible.
- [x] Create Module Registry.
- [x] Reconcile Roadmap Registry.
- [x] Create Technical Debt Register.
- [x] Create Engineering Dashboard.
- [x] Register Design Studio as a separate product program.
- [ ] Merge the governance documentation PR after exact-head validation.

## Completed — Sprint 13A RC1

- [x] Environment metadata and tenant-aware feature flags.
- [x] UAT plans, cases, executions, defects and readiness.
- [x] Deterministic Development/UAT personas and simulation data.
- [x] Keramos and Sample Laboratory A isolation scenarios.
- [x] Role-aware dashboards and navigation.
- [x] Executive Command Center operational preview.
- [x] Remember This Device and Development/UAT password reset.
- [x] UAT screenshot evidence through ObjectStorage.
- [x] Migration 0007 and rollback/reapplication.
- [x] Runtime reliability instrumentation.
- [x] RC1 business startup and walkthrough package.
- [x] Runtime Validation, Sprint 13A Validation and 23/23 Playwright certification.

## Next — Sprint 13B Commercial Control Plane

Blocked until Business UAT closes.

- [ ] Implement permanent Platform Owner and Tenant Owner boundaries.
- [ ] Implement tenant provisioning and ownership.
- [ ] Implement trial, active, past-due, grace, suspended, cancelled and archived subscription states.
- [ ] Implement licenses and entitlements.
- [ ] Implement suspension/reactivation.
- [ ] Implement explicit, expiring and audited tenant support grants.
- [ ] Combine deployment, entitlement, tenant configuration, user permission and domain prerequisite checks.

## Future approved sequence

### Sprint 13C — Tenant Customization Studio

- [ ] Business Profile and tenant identity.
- [ ] Branding, themes and approved asset tokens.
- [ ] Document and communication templates.
- [ ] Portal, registration, security and support settings.

### Sprint 13D — Tax and Compliance

- [ ] Jurisdictions and historical rate versions.
- [ ] Exemption profiles, certificates, verification, expiration and renewal.
- [ ] Immutable tax determinations.
- [ ] Sales and Use Tax reporting and Billing command integration.

### Sprint 13E — ECC, BI and Accounting Foundation

- [ ] Governed KPI registry, targets and alerts.
- [ ] Tenant-isolated facts, dimensions, snapshots and lineage.
- [ ] Production, quality, communications, financial, customer and operational calculators.
- [ ] Chart of Accounts, journals, periods, recognition and reconciliation foundations.

### Sprint 13F — White-Label Laboratory Platform

- [ ] Portal identities and Practice memberships.
- [ ] Branded Doctor and office-user experience.
- [ ] Case, file, prescription, communication, Billing, payment, pickup and supply workflows.
- [ ] Website integration and future custom domains.

### Sprint 13G — Workflow Engine

- [ ] Versioned templates, states and transitions.
- [ ] Runtime instances, queues, assignments and approvals.
- [ ] SLA timers, outbox, idempotent consumers, retries and dead-letter review.

## Cross-cutting deferred work

- [ ] Managed cloud ObjectStorage and secure migration.
- [ ] Malware scanning, quarantine, retention and legal holds.
- [ ] Production email/SMS/push/CTI providers.
- [ ] OIDC/SAML/SCIM, MFA/passkeys and step-up authentication.
- [ ] Distributed rate limiting and managed secrets.
- [ ] Scanner, payment, shipping, tax and accounting provider adapters.
- [ ] Billing-owned Pricing Schedule calculation and post-QC command/outbox.
- [ ] Controlled Legacy Case Intake migration.
- [ ] Backup/restore automation, tenant recovery and continuity exercises.
- [ ] Performance/load and accessibility certification.

## Design Studio — separate program

- [ ] Establish independent Design Studio Architecture Bible and ADR index.
- [ ] Define versioned NorthStar integration contracts.
- [ ] Define artifact provenance, authorization and storage boundaries.
- [ ] Plan viewer, design-session, CAD adapter and manufacturing-handoff milestones.

No Design Studio runtime work is included in the NorthStar ERP backlog unless it is an explicitly approved cross-product integration contract.