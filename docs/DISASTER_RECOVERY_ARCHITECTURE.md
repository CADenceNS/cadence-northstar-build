# Disaster Recovery & Business Continuity Architecture

## Purpose

Define recovery objectives, backup boundaries, testing, incident governance and tenant recovery for NorthStar as a commercial multi-tenant SaaS platform.

## Service tiers and objectives

Exact production objectives require deployment approval, but the architecture supports tiered targets:

| Capability | Proposed RPO | Proposed RTO |
|---|---:|---:|
| Identity, tenant configuration, operational PostgreSQL | ≤ 15 minutes | ≤ 4 hours |
| ObjectStorage clinical and business files | ≤ 1 hour | ≤ 8 hours |
| Communications and audit | ≤ 15 minutes | ≤ 4 hours |
| Billing, tax and accounting records | ≤ 15 minutes | ≤ 4 hours |
| Analytics warehouse and derived projections | ≤ 24 hours | ≤ 24 hours, rebuildable |
| Demo/UAT environments | best effort | ≤ 48 hours |

Final RPO/RTO values are contractual configuration, monitored and tested.

## Recovery domains

- application deployment and configuration;
- PostgreSQL operational databases;
- ObjectStorage objects and metadata;
- secrets and encryption-key references;
- event outbox, queues and background jobs;
- analytical warehouse and snapshots;
- identity-provider and integration configuration;
- audit, release manifests and ADR/documentation evidence.

## Backup architecture

- encrypted full backups with incremental or continuous log capture;
- cross-zone and approved cross-region replication;
- immutable retention tiers and deletion protection;
- separate backup credentials and administrative boundary;
- ObjectStorage versioning and lifecycle policies;
- configuration and infrastructure-as-code preservation;
- regular restore verification, not backup-success checks alone;
- tenant-aware inventory and lineage for legal holds and recovery scope.

## Replication

Primary/replica topology may provide high availability but does not replace backups. Replication lag, corruption propagation and regional failure are monitored. Promotion requires controlled fencing to prevent split brain.

## Tenant recovery

Recovery scopes include full platform, region, environment, tenant, tenant location, time window and selected ObjectStorage sets. Tenant-level recovery uses an isolated restore environment, validates referential integrity and object lineage, then applies an approved reconciliation/import plan. It must not overwrite current tenant data without explicit authorization and a rollback point.

## Database recovery

Recovery procedures include:

1. declare incident and target recovery point;
2. fence writes and preserve evidence;
3. restore base backup;
4. replay logs to target time;
5. apply integrity, tenant-isolation and migration checks;
6. reconcile outbox/jobs and external side effects;
7. validate application and critical browser workflows;
8. approve return to service;
9. monitor and complete post-incident review.

## ObjectStorage recovery

Object metadata and bytes are recovered together. Verification checks object ID, tenant, kind, size, checksum, encryption metadata, retention/legal-hold state and owning entity relationship. Internal object keys remain private.

## Queue and event recovery

Outbox events are replayable and idempotent. Queue consumers use leases, stable event IDs and deduplication. Recovery distinguishes committed domain state from undelivered side effects. Dead-letter items require review before replay.

## Business continuity

Continuity controls include degraded read-only mode where safe, emergency data export, communication procedures, manual laboratory fallback procedures, priority tenant support, vendor escalation, staffing assignments and status-page updates. Commercial suspension and disaster recovery are separate states.

## Monitoring and incident response

Monitor database availability/lag, backup age, restore-test age, ObjectStorage replication, queue lag, error rate, latency, certificate/secret expiry and regional dependencies. Incidents follow severity classification, commander assignment, evidence preservation, customer communication, recovery checkpoints and post-incident corrective actions.

## Recovery testing

- monthly automated restore verification;
- quarterly component recovery exercises;
- semiannual tenant recovery exercise;
- annual regional failover/business-continuity exercise;
- release-candidate checks for migration rollback and backup compatibility;
- evidence retained in the assurance domain with defects for failures.

## Security

Backups are encrypted, access-controlled, logged and excluded from normal application credentials. Restore access requires elevated approval. Production data is not restored into Development or UAT without approved de-identification.

## Non-goals

No cloud provider, backup product, replication topology, incident platform or automated restore tooling is selected or implemented in Sprint 13 architecture.