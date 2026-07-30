# CADence NorthStar Module Registry

## Registry policy

This registry records module ownership and delivery status. Completion percentages are governance estimates of approved scope, not code-coverage metrics. Every future sprint must update affected rows.

Status values: Implemented, Active UAT, Preview, Architecture Complete, Planned, Deferred, Separate Product, Superseded.

| Module | Purpose | Status | Completion | Dependencies | Last updated | Current sprint | Next planned work |
|---|---|---:|---:|---|---|---|---|
| Authentication | Secure login, logout, sessions, CSRF, timeout, remember-device and reset | Active UAT | 90% | PostgreSQL, Security Audit | 2026-07-30 | Sprint 13A RC1 | Production delivery, MFA/SSO and user administration after UAT |
| Authorization | Tenant, role, location, Practice and entity access enforcement | Active UAT | 90% | Authentication, domain ownership | 2026-07-30 | Sprint 13A RC1 | Commercial Platform Owner/support-grant model in Sprint 13B |
| Security Audit | Immutable authentication, authorization and mutation evidence | Implemented | 85% | PostgreSQL, identity context | 2026-07-30 | RC1 | Retention, export, monitoring and step-up evidence |
| Practice Management | Laboratory customer account management | Implemented | 90% | Authorization, repositories | 2026-07-30 | RC1 | Business UAT defects and future portal registration policies |
| Doctor Management | Doctors and Practice relationships | Implemented | 90% | Practice Management | 2026-07-30 | RC1 | Portal memberships and richer preferences |
| Patient Management | Tenant/Practice-scoped patient references | Implemented | 80% | Practice, Doctor, authorization | 2026-07-30 | RC1 | Portal and retention policy refinement |
| Legacy Case Intake | Existing clinical case creation and attachments | Implemented / compatibility | 85% | Patient, Practice, Product data | 2026-07-30 | RC1 | Controlled migration behind Digital Intake command; no silent replacement |
| Digital Intake | Scanner/manual/physical submissions and prescription lifecycle | Implemented | 85% | ObjectStorage, Product Resolution, routing | 2026-07-30 | RC1 | Production scanner adapters, malware/quarantine and service refactor |
| Smart Digital Prescription | Versioned restoration-aware prescription | Implemented | 85% | Digital Intake, Product Catalog | 2026-07-30 | RC1 | UAT refinement and future portal experience |
| Product Catalog | Price-free product identity | Implemented foundation | 75% | Shared contracts | 2026-07-30 | RC1 | Tenant administration and expanded catalog governance |
| Product Resolution | Resolve prescriptions to billable product identity | Implemented foundation | 75% | Product Catalog, Digital Intake | 2026-07-30 | RC1 | Billing command integration and expanded rules |
| Pricing Schedules | Customer pricing configuration boundary | Implemented foundation | 35% | Product Catalog, Billing | 2026-07-30 | RC1 | Eligibility and calculation runtime after approved sprint |
| Routing Administration | Doctor, Practice and tenant routing precedence | Implemented foundation | 70% | Digital Intake, authorization | 2026-07-30 | RC1 | UAT and future workflow integration |
| Production | Department workflow, queues, assignments and status | Implemented | 85% | Cases, users, repositories | 2026-07-30 | RC1 | Business UAT and future Workflow Engine orchestration |
| Quality Control | Inspection templates, outcomes, defects and quality metrics | Implemented | 85% | Production, ObjectStorage | 2026-07-30 | RC1 | Business UAT, richer reason codes and analytical projections |
| Shipping and Logistics | Packing, shipment, tracking and delivery lifecycle | Implemented | 80% | Cases, QC, repositories | 2026-07-30 | RC1 | Carrier adapters, pickup/supply maturity and document generation |
| Billing and Financial Operations | Invoices, payments, statements and AR | Implemented | 75% | Shipping, Product Resolution | 2026-07-30 | RC1 | Pricing calculation, post-QC command, PDFs, provider integration |
| Communications | Append-only operational history and notifications | Implemented | 85% | Authorization, ObjectStorage | 2026-07-30 | RC1 | Delivery providers, portal policies, retention and exports |
| ObjectStorage | Provider-neutral file storage | Implemented foundation | 65% | PostgreSQL, authorization | 2026-07-30 | RC1 | Managed cloud provider, signed access, malware and lifecycle controls |
| Operational Dashboard | Current system-of-record metrics and role dashboards | Implemented | 80% | Source domains | 2026-07-30 | RC1 | Business UAT polish only; do not duplicate future BI |
| Executive Command Center Preview | Executive cards and operational visualizations | Preview | 45% | Operational Dashboard, feature flags | 2026-07-30 | RC1 | UAT feedback; warehouse-backed ECC planned for Sprint 13E |
| UAT Workspace | Plans, cases, executions, defects and readiness | Active UAT | 85% | Auth, ObjectStorage, feature flags | 2026-07-30 | Sprint 13A RC1 | Complete Business UAT cycle and resolve findings |
| Deterministic UAT Simulation | Repeatable personas and operational test data | Active UAT | 80% | UAT, repositories | 2026-07-30 | Sprint 13A RC1 | Hosted UAT and reset governance |
| Feature Flags | Tenant/environment/role gated incomplete capabilities | Implemented foundation | 65% | Auth, environment metadata | 2026-07-30 | RC1 | Commercial entitlement combination in Sprint 13B |
| Platform Owner Control Plane | Tenant provisioning, commercial governance and support grants | Architecture Complete | 10% | Licensing, audit, authorization | 2026-07-30 | Architecture | Sprint 13B after Business UAT |
| Licensing and Subscriptions | Trials, active/grace/suspension/cancellation and entitlements | Architecture Complete | 10% | Platform Owner, Billing separation | 2026-07-30 | Architecture | Sprint 13B after Business UAT |
| Tenant Customization Studio | Business profile, branding, policies and templates | Architecture Complete | 10% | Tenant ownership, ObjectStorage | 2026-07-30 | Architecture | Sprint 13C |
| Tax and Exemptions | Jurisdictions, rates, certificates and determinations | Architecture Complete | 10% | Billing, ObjectStorage, audit | 2026-07-30 | Architecture | Sprint 13D |
| Enterprise BI | Warehouse, facts, dimensions and certified snapshots | Architecture Complete | 5% | Outbox/extraction, source domains | 2026-07-30 | Architecture | Sprint 13E |
| Financial Accounting | Chart of Accounts, GL, journals and periods | Architecture Complete | 5% | Billing events, Tax | 2026-07-30 | Architecture | Sprint 13E |
| White-Label Laboratory Platform | Laboratory-branded Doctor and office experience | Architecture Complete | 10% | Auth, Practices, Digital Intake, Billing | 2026-07-30 | Architecture | Sprint 13F |
| Workflow Engine | Versioned templates, runtime, queues, SLA and approvals | Architecture Complete | 5% | Outbox, domain commands | 2026-07-30 | Architecture | Sprint 13G; planning review before code |
| Integration Platform | REST/webhooks/import/export/provider adapters | Architecture Complete | 5% | Security, outbox, secrets | 2026-07-30 | Architecture | Phased with provider needs |
| Disaster Recovery | Backup, restore, RPO/RTO and continuity evidence | Architecture Complete | 10% | Deployment infrastructure | 2026-07-30 | Architecture | Operational readiness before GA |
| Design Studio | Separate CAD/design product and artifact authoring | Separate Product | Governance registered | Versioned NorthStar integration contracts | 2026-07-30 | Governance | Independent architecture and milestones; no ERP merge |

## Superseded implementation approaches

| Item | Status | Replacement |
|---|---|---|
| Browser localStorage authentication | Superseded | Server-managed sessions |
| In-memory production persistence | Superseded | PostgreSQL repositories |
| Historical stacked PR branches | Superseded | Consolidated validated `main` baselines |
| Generated/duplicate ERP modules | Prohibited | Extend the canonical owning module |

## Update requirement

A pull request that changes module behavior, ownership, completion or sequencing is incomplete until this registry is updated.