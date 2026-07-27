# CADence NorthStar Master Architecture

## Status and authority

This document is the permanent architectural reference for CADence NorthStar after Community Preview 1 Beta. Future sprint designs, pull requests, infrastructure changes, and module extractions must conform to it or include an explicit Architecture Decision Record explaining the exception.

The platform is currently a PostgreSQL-backed modular monolith. That is the preferred operating model until a boundary requires independent scaling, deployment, security isolation, fault containment, or a different runtime.

## Platform context

CADence NorthStar is intended to become an enterprise operating platform for dental laboratories, digital dentistry, CAD processing, manufacturing intelligence, and AI-assisted clinical services.

```text
Doctors / Practice Staff / Laboratory Staff / Administrators
                              |
                    Web and future portals
                              |
                 NorthStar Application Platform
     +------------------------+------------------------+
     | ERP Domains            | Digital/Clinical       |
     | Auth, Practice, Doctor | Scanner Gateway        |
     | Patient, Case, Prod.   | Mesh/DICOM/CAD         |
     | QC, Shipping, Billing  | Clinical AI services   |
     +------------------------+------------------------+
                              |
       PostgreSQL | Object Storage | Events | Observability
                              |
      Cloud infrastructure, integrations, and compute workers
```

## Architectural principles

1. **Preserve domain behavior.** Persistence, deployment, and transport changes must not duplicate or silently alter business rules.
2. **Modular monolith first.** Keep transactional ERP workflows together while enforcing internal module boundaries.
3. **Interfaces at every infrastructure edge.** Repositories, object storage, identity, event publication, courier, payment, scanner, CAD, and AI providers are accessed through typed contracts.
4. **Tenant context is mandatory.** Every durable record, request, job, object, audit event, and metric belongs to a tenant and eventually a location.
5. **Audit is append-only.** Authenticated mutations and workflow transitions emit immutable events.
6. **Files are objects, not JSON payloads.** APIs may remain backward compatible, but production bytes are stored through `ObjectStorage`.
7. **Transactions protect invariants.** Cross-aggregate operations use an application transaction boundary or an event-driven saga when they span services.
8. **Backward compatibility is deliberate.** Public contracts are versioned, migrations are reversible through backup restoration, and deprecations are documented.
9. **Extraction follows evidence.** A module becomes a service only when operational requirements justify the cost.
10. **Clinical assistance is explainable.** AI outputs must retain provenance, confidence, human review, and non-diagnostic positioning unless regulatory requirements are met.

## Current repository structure

```text
/
├── apps/
│   ├── api/                 Express application and production composition root
│   │   ├── migrations/      Ordered PostgreSQL migrations and rollback scripts
│   │   └── src/
│   │       ├── infrastructure/
│   │       ├── durable-server.ts
│   │       ├── qc-gateway.ts
│   │       ├── qc.ts
│   │       ├── shipping.ts
│   │       └── billing.ts
│   └── web/                 Authenticated React/Vite application
├── packages/
│   └── shared/              Shared domain contracts and API types
├── tests/                   Playwright end-to-end suites
├── docs/                    Architecture, sprint, database, release, and policy docs
└── .github/workflows/       CI and runtime validation
```

## Target repository structure

The monorepo should evolve without a disruptive rewrite:

```text
apps/
  api/                       HTTP composition and compatibility routes
  web/                       Laboratory ERP client
  doctor-portal/             Future external practice portal
  patient-portal/            Future patient-facing workflows
services/
  scanner-gateway/           Scanner ingestion and normalization
  mesh-engine/               Mesh validation, conversion, repair, analysis
  dicom-engine/              DICOM ingestion, indexing, and rendering preparation
  cad-orchestrator/          CAD jobs and compute-worker coordination
  clinical-ai/               Versioned AI inference and evidence records
  manufacturing-intel/       Equipment, material, nesting, and production optimization
packages/
  domain-*/                  Domain models and application services
  contracts/                 Versioned public schemas and event contracts
  infrastructure/            Shared provider adapters and observability
  ui/                        Approved reusable UI primitives
```

Movement toward this structure must occur incrementally. Existing modules should be extracted behind interfaces before files are relocated.

## Dependency flow

Dependencies point inward:

```text
React / HTTP / Jobs
        |
Application services and use cases
        |
Domain models, policies, and repository interfaces
        |
PostgreSQL, ObjectStorage, queues, external providers
```

Rules:

- Domain and application code must not import Express, React, `pg`, cloud SDKs, or vendor clients.
- Infrastructure adapters may depend on domain contracts, never the reverse.
- UI code consumes API contracts and must not reproduce server-side business rules.
- Cross-module reads use application queries; cross-module writes use orchestrated use cases.
- Shared packages contain stable contracts, not arbitrary utilities or module internals.

## Current module boundaries

The current modular-monolith domains are:

- Authentication
- Practice
- Doctor
- Patient
- Case Intake
- Production Workflow
- Quality Control
- Shipping & Logistics
- Billing & Financial
- Infrastructure Core

Each owns its state transitions and validation. Other modules reference it by identifier or use a published application interface.

Examples:

- QC may change a Case to `ready-to-ship` through a Case application command; it does not mutate Case tables directly.
- Shipping may complete linked Cases and request invoice generation through application interfaces.
- Billing consumes delivered-shipment information but owns invoice, adjustment, payment, aging, and statement state.

## Application layers

### Presentation

- React workspaces and future portals
- Accessible, responsive UI
- API client and session handling
- No authoritative business-rule calculations

### Transport

- Versioned REST APIs for current clients
- Future event and worker interfaces
- Request validation, authentication, tenant resolution, correlation IDs, and error mapping

### Application

- Use cases and orchestration
- Transaction boundaries
- Authorization checks
- Audit emission
- Idempotency handling
- Event publication after committed writes

### Domain

- Entities, value objects, invariants, policies, lifecycle state machines, and domain events
- No infrastructure dependencies

### Infrastructure

- PostgreSQL repositories
- Object storage
- Identity providers and sessions
- Message broker/outbox
- Search and analytics adapters
- Observability and secrets

## Data architecture

### System of record

PostgreSQL is the authoritative store for transactional ERP data. The repository-document compatibility layer preserves CP1 behavior while normalized schemas are adopted by domain-specific repositories.

### Objects

`ObjectStorage` is the authoritative byte store for STL, OBJ, PLY, DICOM/CBCT, clinical photographs, QC photographs, RX PDFs, invoice PDFs, and shipping documents. PostgreSQL stores ownership, checksum, content type, size, provider key, retention state, and audit linkage.

### Events

A future transactional outbox will publish committed domain events. Consumers must be idempotent. Events are not substitutes for authoritative records.

### Analytics

Operational dashboards initially query PostgreSQL through application read models. High-volume analytics should later use asynchronously maintained projections or a warehouse, never ad hoc queries against write paths that threaten ERP performance.

## Service boundaries and extraction criteria

A boundary is eligible for service extraction when at least one is true:

- It requires independent horizontal scaling or specialized compute.
- It uses a different security or regulatory boundary.
- It has a materially different release cadence.
- Failure must be isolated from ERP transactions.
- It requires long-running asynchronous processing.
- It needs technology unsuitable for the primary Node.js runtime.

Likely service candidates:

1. **Scanner Gateway** — external connectivity, ingestion bursts, provider-specific adapters.
2. **Mesh Engine** — CPU/GPU-heavy geometry operations and native libraries.
3. **DICOM Engine** — large imaging datasets, indexing, conversion, and protected-health-data controls.
4. **CAD Orchestrator and workers** — long-running jobs, licensed engines, compute scheduling.
5. **Clinical AI** — model serving, versioning, inference provenance, safety controls.
6. **Manufacturing Intelligence** — equipment telemetry, optimization, and high-volume time-series data.
7. **Notification service** — email/SMS/provider isolation when communication volume warrants it.

Authentication, master data, cases, production, QC, shipping, and billing should remain in the transactional ERP boundary until independent service ownership is justified.

## Future cloud architecture

```text
CDN / WAF
    |
Web applications ---- Identity provider
    |
API gateway / ingress
    |
ERP application service ---- PostgreSQL primary / replicas
    |            |           Object storage
    |            |           Redis/cache (when justified)
    |            +----------- Transactional outbox
    |                            |
    +----------------------- Message broker
                                 |
             Scanner | Mesh | DICOM | CAD | AI | Manufacturing workers
                                 |
                       Observability platform
```

Cloud requirements:

- Separate development, preview, staging, and production environments.
- Infrastructure as code and immutable deployments.
- Managed PostgreSQL with point-in-time recovery.
- Encrypted object storage with lifecycle and malware scanning.
- Secret manager and key-management service.
- Central logs, metrics, traces, alerting, and audit export.
- Private networking for databases and compute workers.
- Tenant-aware rate limiting and resource quotas.
- Backups tested through scheduled restoration exercises.

## Scalability strategy

### Phase 1: vertical and application scaling

- Stateless API replicas behind a load balancer
- Connection pooling
- Indexed PostgreSQL queries
- Object storage for large files
- Background jobs for noninteractive work

### Phase 2: read and workload separation

- Read replicas and read models
- Dedicated worker pools
- Queue partitioning by tenant, location, and job type
- Caching only where invalidation is explicit

### Phase 3: service and data partitioning

- Extract compute-heavy services
- Partition large audit, event, object, and telemetry tables
- Tenant or region placement policies
- Warehouse/lakehouse for longitudinal analytics

### Phase 4: global and regulated deployment

- Regional data residency
- Cross-region recovery
- Tenant-specific encryption and retention policies
- Formal clinical and security compliance controls

## Reliability and security

- Health, readiness, and dependency probes
- Graceful shutdown and transaction draining
- Timeouts, retries with jitter, circuit breakers, and dead-letter handling
- Idempotency keys for externally retried mutations
- Least-privilege authorization at route and application-service layers
- Encryption in transit and at rest
- Tamper-resistant audit retention
- Dependency and container scanning
- Incident runbooks, recovery objectives, and restore testing

## Architectural debt identified at CP1 Beta

These are recommendations, not implementation changes:

1. `qc-gateway.ts` currently acts as a broad composition and compatibility gateway; split composition, proxy compatibility, and application startup responsibilities.
2. `durable-server.ts` contains many ERP routes and use cases; divide it into domain routers and application services while preserving one deployable API.
3. `packages/shared/src/index.ts` will become a contract bottleneck; organize contracts by domain and expose stable package entry points.
4. UI sprint shells and large management components should converge on feature folders, a typed API client, shared form primitives, and route-level code splitting.
5. Repository-document JSONB compatibility is valuable for migration but should not become the permanent model for high-volume queries; progressively adopt normalized repositories.
6. Authentication remains development-oriented; future work needs an external identity provider, secure server sessions, rotation, and granular authorization.
7. Audit emission is distributed among handlers; centralize mutation context and audit policy to prevent omissions.
8. Cross-module workflows need explicit application commands and eventual outbox events rather than internal HTTP calls as complexity grows.
9. Latest-version dependencies reduce reproducibility; establish controlled dependency update policy and lock major versions.
10. Add unit and component testing below Playwright so failures localize faster while retaining end-to-end gates.

## Architecture governance

- Material decisions require an ADR under `docs/ADR/`.
- Every sprint references affected modules and architecture sections.
- Architectural exceptions include owner, rationale, risk, review date, and removal plan.
- The Engineering Constitution defines mandatory validation and review requirements.
- This document is reviewed at every major preview, Beta, Release Candidate, and General Availability milestone.
