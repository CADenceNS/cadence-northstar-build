# ADR-015 — Recovery as a Tested Governance Capability

## Status
Accepted for architecture; implementation deferred.

## Decision
NorthStar disaster recovery will govern database, ObjectStorage, queue, configuration, secret and analytical recovery through explicit RPO/RTO classes, immutable backups, tenant-aware restore procedures and scheduled recovery exercises. Replication does not replace backups.

## Consequences
Recovery evidence belongs to Release Assurance. Tenant recovery occurs in isolation before reconciliation. Restores require elevated approval, audit and integrity/tenant-isolation validation. Production data may not enter lower environments without approved de-identification.