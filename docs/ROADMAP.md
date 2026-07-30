# CADence NorthStar Product and Engineering Roadmap

## Purpose

This roadmap sequences CADence NorthStar from Community Preview 1 Beta to a production-grade enterprise, digital, CAD, manufacturing, and AI platform. It describes outcomes and dependencies; it is not a promise of calendar dates. Each milestone requires validated scope, architecture review, and release gates defined in `RELEASE_STRATEGY.md`.

## Sequencing principles

- Protect the durable ERP foundation before expanding the product surface.
- Build external integrations behind stable contracts.
- Introduce asynchronous processing before compute-heavy CAD and AI workloads.
- Establish security, observability, backup, and operational ownership before General Availability.
- Preserve backward compatibility unless a documented migration window is approved.
- Prefer complete vertical slices over partially connected feature catalogs.

## Achieved milestone: Community Preview 1 Beta

**Outcome:** A working authenticated laboratory ERP with durable PostgreSQL persistence.

Delivered capabilities:

- Practice, Doctor, Patient, and Case management
- Production workflow routing
- Quality Control
- Shipping and Logistics
- Billing and Financial operations
- PostgreSQL repositories
- Object-storage abstraction
- Immutable audit history
- Restart persistence
- CI, runtime, and Playwright regression validation

This milestone establishes the transactional system of record.

## Architecture Planning Sprint

**Outcome:** Permanent architectural, product, module, engineering, and release governance.

Deliverables:

- Master Architecture
- Platform Vision
- Module Catalog
- Engineering Constitution
- Release Strategy
- Long-term Roadmap
- Architectural-debt register and extraction guidance

No product functionality is delivered in this milestone.

## Community Preview 2

### Primary initiatives

1. **Security and identity foundation**
   - Production identity provider
   - Secure server sessions
   - Role and permission model
   - Tenant and location membership
   - Server-side authorization

2. **API and module hardening**
   - Domain routers and application services
   - Versioned API contracts
   - Standard error, pagination, filtering, idempotency, and correlation IDs
   - Central mutation and audit context

3. **Operational platform foundation**
   - Environment configuration and secrets
   - Structured logs, metrics, traces, and alerting
   - Backup and restore automation
   - Preview and staging environments

4. **Clinical Communications**
   - Case-linked communications
   - Structured clarification requests
   - Notification provider abstraction
   - Communication audit and delivery status

### Dependencies

- CP1 durable persistence
- Engineering Constitution
- Authorization and tenancy model

### Exit criteria

- Production-style identity and authorization validated
- Tenant isolation tested end to end
- Observability and recovery runbooks operational
- Existing ERP regressions remain green

## Community Preview 3

### Primary initiatives

1. **Scanner Gateway foundation**
   - Provider adapter contracts
   - Secure inbound case gateway
   - File validation, checksums, malware scanning, and quarantine
   - Scanner/account routing
   - Idempotent ingestion and retry handling

2. **Doctor Portal**
   - Practice-scoped case submission and visibility
   - Secure file upload
   - Case status and clarification workflows
   - Role-limited access

3. **Cloud object storage**
   - Managed provider adapter
   - Encryption, retention, lifecycle, and signed access
   - Migration from PostgreSQL object bytes where appropriate

4. **Background job platform**
   - Transactional outbox
   - Message broker
   - Worker orchestration
   - Dead-letter and replay controls

### Dependencies

- CP2 identity, tenancy, authorization, and operations
- Stable object and event contracts

### Exit criteria

- One or more scanner integrations validated in a preview environment
- Doctor Portal operates without access to laboratory-only resources
- Ingestion survives retries without duplicate cases or objects

## Beta

### Primary initiatives

1. **Digital visualization foundation**
   - STL/OBJ/PLY metadata and preview pipeline
   - Web STL Viewer
   - DICOM ingestion and viewer preparation
   - Case-linked imaging workspace

2. **Mesh Engine foundation**
   - File conversion and validation
   - Mesh statistics
   - Repair and normalization jobs
   - Versioned derived artifacts

3. **Production and manufacturing hardening**
   - Inventory and material traceability
   - Equipment and job identifiers
   - Barcode/scanner operational integration
   - Capacity and SLA projections

4. **Financial and document maturity**
   - Durable invoice and statement PDFs
   - Payment-provider interfaces
   - Reconciliation and export boundaries

5. **Quality and compliance expansion**
   - Security testing
   - Accessibility validation
   - Data-retention controls
   - Performance and load baselines

### Dependencies

- CP3 gateway, jobs, cloud objects, and portals
- Stable imaging and geometry contracts

### Exit criteria

- Core digital files are viewable and processed asynchronously
- ERP remains responsive during heavy file workloads
- Recovery, security, and performance targets are measured

## Release Candidate

### Primary initiatives

1. **Clinical analysis services**
   - Margin Detection
   - Preparation Analysis
   - Occlusion Analysis
   - Human-review and provenance workflows

2. **Manufacturing Intelligence**
   - Material and machine compatibility
   - Production planning and optimization
   - Equipment telemetry boundary
   - Failure and remake intelligence

3. **Enterprise readiness**
   - Multi-location controls
   - Tenant administration
   - Data export and portability
   - Formal support and incident operations
   - Disaster recovery exercises

4. **Release hardening**
   - API compatibility review
   - Migration rehearsals
   - Upgrade and rollback qualification
   - Full-scale performance, security, and reliability tests

### Dependencies

- Beta imaging, mesh, manufacturing, and operational maturity
- Defined clinical safety and regulatory posture

### Exit criteria

- No unresolved release-blocking defects
- Migration and rollback rehearsed on representative data
- Service objectives and support processes approved
- Security and recovery reviews complete

## Production / General Availability

### Primary initiatives

- Supported production deployment
- Formal semantic versioning and support policy
- Production identity, secrets, backups, monitoring, and incident response
- Contracted recovery objectives
- Tenant onboarding and migration tooling
- Operational dashboards and support diagnostics
- Controlled feature flags and staged rollout

### Exit criteria

- General Availability checklist approved
- Production runbooks exercised
- Data protection, security, and business continuity controls accepted
- Upgrade path from supported preview/beta versions verified

## Post-GA platform expansion

### CAD Platform

- CAD job orchestration
- Design artifact versioning
- Licensed CAD engine adapters
- Compute scheduling
- Review and approval workflows

### Manufacturing Platform

- Nesting and CAM orchestration
- Printer and mill adapters
- Material lot traceability
- Machine utilization and predictive maintenance
- Distributed location scheduling

### AI Platform

- AI Clinical Assistant
- Case risk and clarification recommendations
- Remake and defect intelligence
- Capacity and delivery forecasting
- Model registry, evaluation, monitoring, and governance

### Patient Platform

- Patient Portal where legally and operationally appropriate
- Consent, education, appointment-linked status, and secure communications
- Strict separation from laboratory and doctor authorization domains

## Initiative dependency map

```text
Durable ERP
   |
Architecture + Engineering Governance
   |
Identity / Tenancy / Authorization / Observability
   |
Cloud Objects + Jobs + Scanner Gateway + Doctor Portal
   |
Imaging + Mesh + Digital Visualization
   |
Clinical Analysis + Manufacturing Intelligence
   |
CAD Orchestration + AI Clinical Services
```

## Ongoing engineering tracks

Every milestone includes:

- Security and dependency maintenance
- Database migration and rollback testing
- Performance and capacity testing
- Accessibility and browser validation
- Documentation and ADR maintenance
- Backup restoration exercises
- Tenant-isolation tests
- Full regression testing

## Planning policy

Detailed sprint plans are derived from this roadmap only after architecture, dependencies, risk, and validation gates are defined. Estimated dates belong in delivery planning, not in this permanent roadmap, and must not weaken milestone exit criteria.
