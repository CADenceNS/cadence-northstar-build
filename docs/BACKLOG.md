# Engineering Backlog

## Active — Post-CP2 Platform Readiness

### Sprint 13A — Operational Readiness and Tenant Foundation

- [ ] Implement environment metadata, feature flags, UAT plans/executions, defects, release approvals and deterministic demo/test data.
- [ ] Establish canonical laboratory-tenant ownership contracts and tenant-isolation tests for repositories, ObjectStorage, caches, queues, events, analytics and jobs.

### Sprint 13B — Platform Commercial Control Plane

- [ ] Implement Platform Owner, tenant provisioning, subscriptions, licenses, lifecycle states and entitlements.
- [ ] Implement suspension/reactivation and explicit, expiring, audited support grants.

### Sprint 13C — Tenant Customization Studio

- [ ] Implement Business Profile, branding, support contacts, document/communication templates, portal settings and tenant policies.
- [ ] Add safe asset, typography, color and theme configuration without influencing authorization.

### Sprint 13D — Tax and Compliance

- [ ] Implement jurisdictions, immutable historical tax rates, exemption profiles/certificates, renewal, determinations and Sales/Use Tax exports.
- [ ] Integrate Tax with Billing through a dedicated command.

### Sprint 13E — Executive Command Center, BI and Accounting Foundation

- [ ] Implement governed KPI definitions, targets, thresholds, snapshots, dashboard layouts and drill-down contracts.
- [ ] Implement tenant-isolated analytical facts, dimensions, lineage, time intelligence and certified snapshots.
- [ ] Implement production, quality, communication, financial, customer and operational KPI calculators.
- [ ] Implement chart of accounts, journals, periods, fiscal years, posting rules, revenue recognition and reconciliation foundations.
- [ ] Add authorized exports, data-quality checks and forecasting extension ports.

### Sprint 13F — White-Label Laboratory Platform

- [ ] Implement laboratory-branded portal identity, invitations, sessions and Practice memberships.
- [ ] Implement Doctor/office-user case, file, prescription, status, communication, billing, payment, pickup and supply workflows.
- [ ] Implement website redirection and future custom-domain adapters.

### Sprint 13G — Workflow Engine

- [ ] Implement versioned templates, runtime instances, guarded transitions, queues, assignments, approvals and SLA policies.
- [ ] Implement transactional outbox, idempotent consumers, fair tenant scheduling, timers and dead-letter review.

## Cross-cutting deferred work

- [ ] Implement Integration Platform foundations for REST, webhooks, imports, exports, credentials, mappings and provider adapters.
- [ ] Implement backup, point-in-time recovery, ObjectStorage recovery, tenant restore and recovery-testing automation.
- [ ] Production email/SMS, OIDC/SSO, SCIM, passkeys, TOTP and step-up authentication.
- [ ] Distributed rate limiting, managed secrets, managed ObjectStorage, malware scanning, retention and legal holds.
- [ ] Production scanner, payment, shipping, tax, accounting, AI and identity-provider adapters.
- [ ] Billing-owned Pricing Schedule calculation and post-QC Billing command/outbox.
- [ ] Controlled legacy Case Intake migration and typed intake application-service refactoring.
- [ ] Scale infrastructure such as read replicas, partitioning, pooling proxies and data residency when evidence requires it.

## Architecture Complete — Sprint 13

- [x] Define laboratory-owned tenant, Practice, Doctor and office-user boundaries.
- [x] Define Platform control plane, licensing, Tenant Customization Studio and White-Label Laboratory Platform.
- [x] Define Tax, exemption, UAT, demo/reset and Workflow architecture.
- [x] Define Executive Command Center dashboard hierarchy and executive questions.
- [x] Define governed KPI model, thresholds, refresh, retention, lineage and drill-down.
- [x] Define production, quality, communications, financial, customer and operational KPI catalogs.
- [x] Define enterprise warehouse facts, dimensions, cubes, snapshots and time intelligence.
- [x] Define Accounting boundary, double-entry journals, periods, recognition, AR/AP and close procedures.
- [x] Define provider-neutral Integration Platform.
- [x] Define Disaster Recovery, RPO/RTO, tenant recovery and continuity testing.
- [x] Publish NorthStar Enterprise Architecture Bible.
- [x] Record ADR-006 through ADR-015.
- [x] Publish revised Sprint 13A–13G roadmap without runtime changes.

## Completed — Community Preview 2 Platform

- [x] Sprints 3–12 implementation baseline: Identity/Security, PostgreSQL/ObjectStorage, Practice/Doctor, Patient/Case, Production, QC, Shipping, Billing, Communications and Digital Intake.