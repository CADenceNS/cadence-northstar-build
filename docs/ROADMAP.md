# CADence NorthStar Roadmap Registry

## Purpose

This is the canonical sequencing registry. Work may move between categories only through an approved planning or release decision. Previously approved work must remain visible even when deferred.

Authoritative implementation baseline: RC1 merge commit `b05da10bb633bb48e51f08a9b10bef4a88d152a3`.

## Completed

### Community Preview 1 / Durable ERP foundation

- Practice, Doctor, patient and case management
- Production workflow
- Quality Control
- Shipping and logistics
- Billing and financial operations
- PostgreSQL repositories
- ObjectStorage abstraction
- Immutable audit
- Runtime and browser validation

### Community Preview 2

- Production identity and server-managed sessions
- Centralized authorization and tenant/Practice/entity boundaries
- Clinical Communications operational history
- Digital Intake Platform
- Smart Digital Prescription
- Scanner Provider abstraction
- Product Catalog and Product Resolution separation
- Routing administration
- Pricing Schedule foundation
- Architecture and ADR governance
- Community Preview 2 certification baseline

### Sprint 13 architecture

- Laboratory-owned tenant hierarchy
- Platform Owner and licensing architecture
- Tenant Customization Studio architecture
- Tax and exemption architecture
- White-Label Laboratory Platform architecture
- Executive Command Center and KPI architecture
- Enterprise BI and Accounting architecture
- Integration Platform architecture
- Disaster Recovery architecture
- Workflow Engine architecture
- Enterprise Architecture Bible and ADR-006 through ADR-015

### Sprint 13A / RC1 engineering implementation

- UAT plans, test cases, executions, defects and readiness
- Feature flags and environment metadata
- Deterministic Development/UAT personas and seed environment
- Keramos and Sample Laboratory A isolation scenarios
- Role-aware dashboards and navigation
- Executive Command Center operational preview
- Remember This Device and Development/UAT password reset
- UAT screenshot evidence through ObjectStorage
- Runtime reliability instrumentation
- RC1 package, walkthrough and release manifest
- Runtime Validation passed
- Sprint 13A Validation passed
- Playwright 23/23 passed

## Business UAT

Current program state. Feature development is paused.

Required outcomes:

- Execute the RC1 business walkthrough.
- Operate the application under realistic Keramos workflows.
- Record defects, enhancements, UI concerns and missing functionality.
- Validate role permissions and tenant isolation.
- Validate case, production, QC, shipping, Billing, Doctor and executive workflows.
- Resolve or disposition all Critical and High defects.
- Obtain business-owner sign-off or conditional rejection.

Exit criterion: formal UAT review approves the next planning phase.

## Current development

### Engineering continuity governance

- Master Development Bible
- Repository Status Report
- Module Registry
- Roadmap Registry
- Technical Debt Register
- Engineering Dashboard
- Design Studio program boundary

No ERP runtime behavior is included in this workstream.

## Next sprint

### Sprint 13B — Commercial Control Plane

May begin only after Business UAT is closed.

Approved scope:

- permanent Platform Owner boundary;
- tenant provisioning and ownership;
- subscription lifecycle;
- trial, active, past-due, grace, suspended, cancelled and archived states;
- licenses and entitlements;
- tenant suspension/reactivation;
- explicit, expiring and audited support grants;
- commercial feature evaluation combined with deployment, tenant, user and domain checks.

Before implementation, convert RC1 UAT findings into an approved Sprint 13B plan and confirm no blocking RC1 defects remain.

## Future

### Sprint 13C — Tenant Customization Studio

- Business Profile and tenant identity
- Branding tokens and assets
- Login/dashboard themes
- Document and communication templates
- Financial, security, portal and registration settings

### Sprint 13D — Tax and Compliance

- Tax jurisdictions and historical rates
- Tax exemption profiles and certificates
- Verification, expiration and renewal
- Immutable tax determinations
- Sales and Use Tax reporting
- Billing command integration

### Sprint 13E — Executive Command Center, BI and Accounting Foundation

- Governed KPI registry and thresholds
- Tenant analytical facts/dimensions
- Certified snapshots and lineage
- Production, quality, communications, financial, customer and operational intelligence
- Chart of Accounts, journals, periods and recognition foundations

### Sprint 13F — White-Label Laboratory Platform

- Doctor and office identities/memberships
- Branded portal experience
- Case and prescription submission
- Files, communications, invoices, payments and receipts
- Pickup and supply requests
- Laboratory website integration and future custom domains

### Sprint 13G — Workflow Engine

- Versioned templates and states
- Runtime instances and guarded transitions
- Queues, assignments and approvals
- SLA timers
- Transactional outbox and idempotent events
- Retry, dead-letter and automation controls

### Platform expansion after foundational sprints

- Managed cloud ObjectStorage
- Background jobs and message broker
- Production scanner integrations
- Payment, shipping, tax and accounting providers
- SSO/SCIM/MFA and step-up authentication
- Backup/restore automation and tenant recovery
- Performance, accessibility, security and continuity qualification

### Design Studio program — separate product

- Architecture baseline
- Viewer preview
- Design-session foundation
- CAD adapter foundation
- Manufacturing handoff
- Governed automation and AI assistance

Design Studio remains independent from NorthStar ERP. Only versioned integration contracts are part of the NorthStar roadmap.

## Deferred

These items remain visible but have no approved implementation sprint:

- Patient Portal
- General-purpose real-time chat/presence
- Advanced AI clinical recommendations
- Mesh repair and processing runtime
- Manufacturing equipment telemetry
- Read replicas, partitioning and tenant-specific data residency
- Service extraction from the modular monolith
- Full production custom-domain automation
- Filing/remittance automation for tax authorities

## Release milestones

- **Community Preview:** internal feature-complete milestone.
- **Beta:** business users performing structured UAT.
- **Release Candidate:** feature freeze; corrections only.
- **General Availability:** production-ready supported release.

Required lifecycle:

Development → Unit/Integration Tests → Sprint Validation → Engineering Reliability → Runtime Validation → Business UAT → Release Candidate Approval → Production.

## Planning policy

- Roadmap entries describe outcomes and dependencies, not promised dates.
- A future item cannot be removed; it must move to Completed, Deferred or Superseded with explanation.
- Every approved sprint must update this registry, the Module Registry and Technical Debt Register.
- New implementation must start from current validated `main` or an approved release tag.