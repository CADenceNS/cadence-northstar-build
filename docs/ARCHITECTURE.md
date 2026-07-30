# CADence NorthStar Architecture

## Infrastructure Core

CADence NorthStar uses a layered architecture so verified business behavior does not depend on a persistence provider.

1. **Presentation** — authenticated React workspaces.
2. **Application services** — validation, workflow transitions, SLA, QC, shipping, and financial rules.
3. **Repository contracts** — typed interfaces for users, practices, doctors, patients, cases, production, QC, shipping, finance, and audit.
4. **Infrastructure adapters** — PostgreSQL and object-storage implementations for production; in-memory implementations only for isolated tests.
5. **External integrations** — future scanners, cloud storage, identity providers, CAD services, AI clinical services, and courier/payment providers.

## Production composition

The production API starts through the Sprint 9 composition root, requires `DATABASE_URL`, creates a tenant-scoped `PostgresRegistry`, and injects repositories into the core ERP server, QC engine, shipping engine, and financial engine. The legacy array-backed server remains outside the production import graph.

## Design rules

- Business services communicate through repository interfaces and do not import PostgreSQL clients directly.
- Transactions are available through `RepositoryRegistry.transaction` for cross-repository work.
- Tenant identity is part of every repository context and durable record.
- Audit events are append-only and protected against update or deletion.
- Binary files are persisted through `ObjectStorage`; existing APIs may continue accepting and returning base64 while production storage retains object references and checksummed bytes.
- Internal cross-module synchronization suppresses duplicate audit records.
- Monetary persistence uses PostgreSQL numeric columns or lossless JSON document values at compatibility boundaries.
- Existing routes, React workflows, validation rules, dashboard calculations, and Playwright expectations remain backward compatible.

## Operational routes

- Route A — Pure digital: Receiving → CAD → Manufacturing → Ceramics → QC → Shipping.
- Route B — Hybrid: Receiving → Model → CAD → Manufacturing → Ceramics → QC → Shipping.
- Route C — Manual: Receiving → Model → Ceramics → QC → Shipping.

## Scalability

The tenant-scoped schema, provider-neutral object storage, indexed queues, repository registry, and explicit composition root support multi-location laboratories and future multi-tenant deployments. Scanner, CAD, and AI services should integrate through asynchronous service boundaries without bypassing repository, object-storage, transaction, or audit contracts.

## Verified state

Sprint 9C completed the production cutover. Authentication, master data, patient and case intake, production, QC, shipping, billing, and dashboard metrics run against PostgreSQL. Restart validation proves operational data, relationships, object bytes, audit records, and dashboard counts survive process termination without changing Sprint 8 user workflows.
