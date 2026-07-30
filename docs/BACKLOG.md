# Engineering Backlog

## Active — Post-CP2 Platform Readiness

### Sprint 13A — Operational Readiness and Tenant Foundation

- [ ] Implement environment metadata, feature flags, UAT plans/executions, defects, release approvals and deterministic demo/test data.
- [ ] Establish canonical laboratory-tenant, Practice-customer, Doctor and office-user ownership contracts across repositories and authorization tests.
- [ ] Add tenant-isolation validation for caches, queues, events, ObjectStorage, analytics and background jobs.

### Sprint 13B — Platform Commercial Control Plane

- [ ] Implement Platform Owner, laboratory tenant provisioning, ownership, subscriptions, licenses and lifecycle states.
- [ ] Implement entitlement evaluation in the order: deployment configuration, subscription entitlement, tenant configuration, user permission and domain prerequisites.
- [ ] Implement tenant suspension/reactivation and explicit, expiring, audited support grants.

### Sprint 13C — Tenant Customization and Branding Foundation

- [ ] Implement Tenant Customization Studio foundations for Business Profile, branding, support contacts, security and portal policies.
- [ ] Implement versioned document templates for invoices, statements, receipts, packing slips, labels, prescriptions and reports.
- [ ] Implement versioned email, SMS and notification templates using approved merge fields.
- [ ] Add safe logo/favicon assets, approved color/typography tokens and login/dashboard theme configuration.

### Sprint 13D — Tax and Compliance Foundation

- [ ] Implement jurisdiction and immutable historical tax-rate repositories.
- [ ] Implement customer-level exemption profiles, certificate ObjectStorage, verification, expiration and reminders.
- [ ] Implement immutable tax determinations and Sales/Use Tax exports.
- [ ] Integrate Tax with Billing through a dedicated command without moving tax logic into Billing.

### Sprint 13E — White-Label Laboratory Platform

- [ ] Implement laboratory-branded portal identities, invitations, sessions and Practice memberships.
- [ ] Implement Doctor and office-user case, file, prescription, status, communication, billing, payment, pickup and supply-request policies.
- [ ] Implement laboratory website login/redirection and future custom-domain verification/certificate adapters.
- [ ] Preserve strict Practice and tenant isolation across all portal workflows.

### Sprint 13F — Workflow Engine

- [ ] Implement versioned templates, instances, guarded transitions, queues, assignments, approvals and SLA policies.
- [ ] Implement transactional outbox, idempotent consumers, fair tenant scheduling, timer leases and dead-letter review.
- [ ] Integrate through domain commands without transferring ERP record ownership to Workflow.

## Cross-cutting deferred work

- [ ] Production email/SMS delivery, OIDC/SSO, SCIM, WebAuthn/passkeys, TOTP and step-up authentication.
- [ ] Distributed rate limiting, managed secrets and risk-based authentication.
- [ ] Managed cloud ObjectStorage, encryption-key management, malware scanning, quarantine, retention and legal holds.
- [ ] Production scanner-provider adapters, webhooks and portal SDKs.
- [ ] Billing-owned Pricing Schedule calculation and post-QC Billing command/outbox.
- [ ] Invoice/shipping document bundling and automated statement inclusion.
- [ ] Controlled legacy Case Intake migration behind Digital Intake.
- [ ] Typed application-service/repository refactoring for large intake handlers.
- [ ] Read replicas, partitioning, pooling proxies and tenant-specific data residency when scale requires them.

## Architecture Complete — Sprint 13 Platform Readiness Refinement

- [x] Define laboratories as subscribing tenants; Practices and Doctors as tenant customers.
- [x] Define Platform, Tenant, Practice, Doctor, office-user and future patient ownership boundaries.
- [x] Replace White-Label Doctor Portal terminology with White-Label Laboratory Platform architecture.
- [x] Define Business identity, visual, document and communication branding.
- [x] Define Tenant Customization Studio and separation from Platform Owner controls.
- [x] Define laboratory website integration and future custom-domain lifecycle.
- [x] Define Doctor/office-user and role-specific laboratory staff experiences.
- [x] Refine subscription states, entitlement evaluation and support grants.
- [x] Refine Tax, exemptions, reporting, historical preservation and provider neutrality.
- [x] Define module-level UAT criteria and blocking defects.
- [x] Refine Workflow Engine tenant isolation, fair scheduling and integration boundaries.
- [x] Update ADR-008 and ADR index.
- [x] Publish phased roadmap without runtime changes.

## Completed — Community Preview 2 Platform

- [x] Sprint 12 Digital Intake Platform Foundation.
- [x] Sprint 11 hardened Clinical Communications Platform.
- [x] Sprint 10 Production Identity and Security.
- [x] Sprint 9 durable PostgreSQL persistence and ObjectStorage.
- [x] Sprints 3–8 Practice/Doctor, Patient/Case, Production, QC, Shipping and Billing foundations.