# CADence NorthStar Architecture

## Infrastructure Core

CADence NorthStar uses a layered architecture so verified business behavior does not depend on a persistence provider.

1. **Presentation** — authenticated React workspaces.
2. **Application services** — validation, workflow transitions, SLA, QC, shipping, and financial rules.
3. **Repository contracts** — typed interfaces for users, practices, doctors, patients, cases, production, QC, shipping, finance, and audit.
4. **Infrastructure adapters** — in-memory implementations for isolated tests and PostgreSQL/object-storage implementations for durable environments.
5. **External integrations** — future scanners, cloud storage, identity providers, CAD services, AI clinical services, and courier/payment providers.

## Design rules

- Business services receive repository interfaces and never import PostgreSQL clients directly.
- Transactions are opened at application-service boundaries spanning multiple repositories.
- Tenant identity is part of every repository context and durable table.
- Audit events are append-only and immutable.
- Binary files are stored through `ObjectStorage`; PostgreSQL stores metadata and provider keys, not large payloads.
- Monetary values use PostgreSQL `numeric` columns and must not be represented as floating-point values in persistence adapters.
- Existing routes, React workflows, validation rules, and Playwright expectations remain backward compatible.

## Operational routes

- Route A — Pure digital: Receiving → CAD → Manufacturing → Ceramics → QC → Shipping.
- Route B — Hybrid: Receiving → Model → CAD → Manufacturing → Ceramics → QC → Shipping.
- Route C — Manual: Receiving → Model → Ceramics → QC → Shipping.

## Scalability

The tenant-scoped schema, provider-neutral object storage, indexed queues, and repository registry support multi-location laboratories and future multi-tenant deployments. Scanner, CAD, and AI services should integrate through asynchronous service boundaries without bypassing repository or audit contracts.

## Current transition state

Sprint 9 introduces the durable contracts, normalized schema, migration/rollback tooling, transaction registry, object-storage boundary, immutable audit repositories, and legacy snapshot importer. Existing ERP services remain operational while each domain is migrated behind repository interfaces. Sprint 9 remains incomplete until all process-memory domain stores have been replaced in the running application and PostgreSQL integration tests prove behavioral parity.
