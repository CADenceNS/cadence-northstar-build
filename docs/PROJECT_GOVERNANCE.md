# NorthStar Project Governance

## Purpose

NorthStar is governed as an enterprise multi-tenant SaaS Laboratory Intelligence Platform. This document defines the permanent development, validation, architectural-review, engineering-reliability, recovery, release and maintenance lifecycle.

The current engineering source of truth is `docs/MASTER_DEVELOPMENT_BIBLE.md`. Module, roadmap and debt status are maintained in their canonical registries and must be updated by every affected sprint.

## Official lifecycle

```text
Feature Development
→ Unit and Integration Tests
→ Sprint Validation
→ Architectural Review
→ Engineering Reliability
→ Runtime Validation
→ Business UAT
→ Release Candidate Approval
→ Community Preview / Beta / General Availability
→ Maintenance
```

## Semantic milestones

| Milestone | Meaning |
|---|---|
| Community Preview | Internally stable, feature-complete milestone for controlled evaluation. |
| Beta | Laboratory business users perform structured UAT with realistic tenant workflows. |
| Release Candidate | Feature freeze; only verified fixes, security, migration, documentation and release engineering. |
| General Availability | Production-ready after UAT, operations, security, recovery, support and approval gates. |

## Commercial tenant model

- NorthStar Platform is operated by Platform Owner.
- Each subscribing dental laboratory is an isolated tenant.
- Tenant Owners and Administrators govern their laboratory.
- Practices, Doctors and office staff are tenant customers and delegated users, not tenants.
- Platform Owner access never implies unrestricted tenant business-data access.

## Multi-tenant requirements

Every domain documents tenant ownership, tenant-resolution source, Practice/entity authorization, cross-tenant denial tests, safe storage/cache/queue/event/analytics keys, support access, suspension/export/retention/deletion, limits and noisy-neighbor protection.

## Engineering continuity requirements

Every sprint or release PR that changes scope or status must update:

- `docs/MODULE_REGISTRY.md`;
- `docs/ROADMAP.md`;
- `docs/TECHNICAL_DEBT.md`;
- `docs/ENGINEERING_DASHBOARD.md`;
- the ADR index when architectural decisions change;
- the release manifest for release candidates.

No module may be duplicated because its status is unclear. Historical branches and sprint documents are evidence, not current planning authorities.

## Intelligence governance

Every executive KPI and analytical dataset requires an approved business definition and formula version, authoritative sources and lineage, dimensional grain, refresh cadence, retention, freshness, thresholds, sensitivity, authorized drill-down, reconciliation tests and restatement policy. Historical fact, forecast and AI insight remain explicitly separate.

Dashboard authors may not introduce unapproved financial, tax or quality formulas. Small-group and restricted-entity inference must be prevented. Exports are tenant-scoped and audited.

## Financial and accounting governance

Billing, Tax and Accounting retain separate ownership. Posted journals and finalized tax determinations are immutable; corrections use linked reversals or replacements. Period close requires reconciliation, evidence, approvals and locked accounting periods. Tenant laboratory books remain separate from NorthStar Platform commercial books.

## Integration governance

External integrations require stable versioned ports, provider adapters, least-privilege credentials, tenant binding, idempotency, signature/replay controls, observability, compatibility policy and dead-letter handling. Providers may not write domain tables or bypass NorthStar authorization.

NorthStar ERP and Design Studio are separate products. Their integration requires versioned contracts and may not use shared internal database tables or duplicated business records.

## Disaster recovery governance

Every production service declares RPO/RTO, backup scope, restore procedure, dependency order, tenant-recovery behavior and test cadence. Backup success alone is insufficient; scheduled restore evidence and continuity exercises are release-assurance records. Production data may not enter lower environments without approved de-identification.

## Branch and merge policy

- Use short-lived focused branches from the latest validated `main` or approved release tag.
- Target `main` or one explicitly approved integration branch.
- Avoid long-lived stacks.
- Keep PRs independently reviewable.
- Update with target before final validation.
- Preserve PR, commit, tag and release traceability.
- Historical feature branches are read-only records, not future development bases.
- Do not begin a major phase until the prior milestone is certified and its UAT decision recorded.

A PR may merge only when its final head is current and required reviews, strict builds, applicable migrations/rollback, repository/security/tenant/domain tests, Engineering Reliability, Runtime Validation, Playwright, documentation and ADR review pass with no unresolved concern. Older-commit evidence never certifies a newer head.

## Architecture policy

Reviews cover domain ownership, layer separation, tenant isolation, authorization, persistence, event/API contracts, analytical lineage, accounting/tax boundaries, migration safety, provider abstraction, recovery, coupling, duplication and scale. Branding, entitlement, flags, hostnames, dashboards and UI visibility never grant authorization. Significant decisions require ADRs.

Approved UI must not be redesigned without explicit product approval. Working systems must be extended through their canonical domain boundaries, not replaced or copied.

## Engineering Reliability

Engineering Reliability is a mandatory pre-release stage that investigates:

- race conditions and async readiness;
- fixture pollution and test isolation;
- flaky selectors and actionability;
- browser and environment differences;
- startup sequencing and service health;
- performance regressions;
- console/page errors;
- trace, screenshot, video and diagnostic evidence;
- repeatability across independent validation workflows.

Reliability corrections use deterministic conditions, not arbitrary sleep delays or weakened assertions.

## Release policy

### Feature Development
New functionality is permitted; architecture, security, tests, registries, documentation and migrations evolve together.

### Sprint Validation
Frozen installation, strict builds, migrations, domain integrations and targeted browser tests pass.

### Architectural Review
Permanent boundaries, ownership, tenant isolation, intelligence formulas, integration contracts and recovery plans are reviewed.

### Engineering Reliability
The validated feature is tested for timing, isolation, actionability and environment-specific behavior.

### Runtime Validation
The complete application is installed, migrated, started and exercised as a running system.

### Business UAT
Business stakeholders operate realistic workflows and record defects, enhancements and sign-off evidence.

### Release Candidate Approval
Feature freeze permits only verified corrections and release engineering. Every RC identifies exact commit, migration, workflows, limitations and rollback.

### Community Preview
Requires integrated primary branch, release notes, version/tag, current validation, ADR completeness and baseline manifest.

### Beta
Adds structured laboratory-user UAT, realistic tenant scenarios, defect triage, approvals, operational readiness and intelligence reconciliation.

### General Availability
Requires deployment, support, incident response, backup/restore tests, monitoring, retention, privacy, security, financial controls and formal approval.

### Maintenance
Uses small branches and patch releases; compatibility changes require approved migration strategy.

## Validation requirements

Every RC and stable milestone includes frozen install, strict production builds, all migrations and changed rollback/reapplication, repository/domain integrations, authentication/authorization/tenant isolation, Engineering Reliability, Runtime Validation, complete Playwright, documentation/ADR validation and exact-final-commit evidence.

Intelligence releases additionally require KPI regression, source reconciliation, lineage and tenant-leakage tests. Accounting releases require balanced-entry and subledger reconciliation tests. Recovery changes require restore evidence.

Validation should be read-only and must not silently modify source or lockfiles.

## ADR requirements

ADRs are required for new domains, ownership changes, integrations, persistence/events, authorization/tenant strategy, analytical warehouse and KPI authority, accounting boundaries, disaster recovery strategy, compatibility/deprecation, orchestration and significant infrastructure/provider choices.

## Documentation policy

Each sprint/release records implemented and verified behavior, exact evidence, deferred work, technical debt, rollback/recovery, ADRs, compatibility and limitations. Architecture-only work explicitly states that runtime behavior is not implemented.

The Master Development Bible and canonical registries represent current truth. Sprint and release documents preserve historical evidence and must not be rewritten to imply work that was not completed at that time.

## Current release state

NorthStar RC1 is integrated into `main` and certified for Business UAT. Feature development is paused until the Business UAT cycle is reviewed and formally closed.