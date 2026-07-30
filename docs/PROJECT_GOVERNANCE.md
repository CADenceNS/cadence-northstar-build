# NorthStar Project Governance

## Purpose

NorthStar is governed as an enterprise multi-tenant SaaS Laboratory Intelligence Platform. This document defines the permanent development, validation, architectural-review, data-intelligence, recovery, release and maintenance lifecycle.

## Official lifecycle

```text
Feature Development
→ Engineering Validation
→ Architectural Review
→ Release Candidate
→ Community Preview
→ Beta, when applicable
→ General Availability
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

## Intelligence governance

Every executive KPI and analytical dataset requires:

- approved business definition and formula version;
- authoritative source domains and lineage;
- dimensional grain and supported filters;
- refresh cadence, retention and freshness status;
- target, warning and critical thresholds;
- sensitivity classification and authorized drill-down;
- reconciliation and data-quality tests;
- restatement policy for corrected historical periods;
- explicit separation between historical fact, forecast and AI-generated insight.

Dashboard authors may not introduce unapproved financial, tax or quality formulas. Small-group and restricted-entity inference must be prevented. Exports are tenant-scoped and audited.

## Financial and accounting governance

Billing, Tax and Accounting retain separate ownership. Posted journals and finalized tax determinations are immutable; corrections use linked reversals or replacements. Period close requires reconciliation, evidence, approvals and locked accounting periods. Tenant laboratory books remain separate from NorthStar Platform commercial books.

## Integration governance

External integrations require stable versioned ports, provider adapters, least-privilege credentials, tenant binding, idempotency, signature/replay controls, observability, compatibility policy and dead-letter handling. Providers may not write domain tables or bypass NorthStar authorization.

## Disaster recovery governance

Every production service declares RPO/RTO, backup scope, restore procedure, dependency order, tenant-recovery behavior and test cadence. Backup success alone is insufficient; scheduled restore evidence and continuity exercises are release-assurance records. Production data may not enter lower environments without approved de-identification.

## Branch and merge policy

- use short-lived focused branches from the latest certified baseline;
- target `main` or one approved integration branch;
- avoid long-lived stacks;
- keep PRs independently reviewable;
- update with target before final validation;
- preserve PR, commit, tag and release traceability;
- do not begin a major phase until the prior milestone is certified and tagged.

A PR may merge only when its final head is current and required reviews, strict builds, applicable migrations/rollback, repository/security/tenant/domain tests, Runtime Validation, Playwright, documentation and ADR review pass with no unresolved concern. Older-commit evidence never certifies a newer head.

## Architecture policy

Reviews cover domain ownership, layer separation, tenant isolation, authorization, persistence, event/API contracts, analytical lineage, accounting/tax boundaries, migration safety, provider abstraction, recovery, coupling, duplication and scale. Branding, entitlement, flags, hostnames, dashboards and UI visibility never grant authorization. Significant decisions require ADRs.

## Release policy

### Feature Development
New functionality is permitted; architecture, security, tests, documentation and migrations evolve together.

### Engineering Validation
Deterministic validation passes without weakening production controls.

### Architectural Review
Permanent boundaries, data ownership, tenant isolation, intelligence formulas, integration contracts and recovery plans are reviewed.

### Release Candidate
Feature freeze permits verified corrections and release engineering only. Every RC identifies exact commit, migration version, validation, known limitations, rollback and recovery considerations.

### Community Preview
Requires integrated primary branch, release notes, version/tag, current validation, ADR completeness and baseline manifest.

### Beta
Adds structured laboratory-user UAT, realistic tenant scenarios, defect triage, approvals, operational-readiness and intelligence reconciliation.

### General Availability
Requires deployment, support, incident response, backup/restore tests, monitoring, retention, privacy, security, financial controls and formal approval.

### Maintenance
Uses small branches and patch releases; compatibility changes require approved migration strategy.

## Validation requirements

Every RC and stable milestone includes frozen install, strict production builds, all migrations and changed rollback/reapplication, repository/domain integrations, authentication/authorization/tenant isolation, Runtime Validation, complete Playwright, documentation/ADR validation and exact-final-commit evidence. Intelligence releases additionally require KPI regression, source reconciliation, lineage and tenant-leakage tests. Accounting releases require balanced-entry and subledger reconciliation tests. Recovery changes require restore evidence.

Validation should be read-only and must not silently modify source or lockfiles.

## ADR requirements

ADRs are required for new domains, ownership changes, integrations, persistence/events, authorization/tenant strategy, analytical warehouse and KPI authority, accounting boundaries, disaster recovery strategy, compatibility/deprecation, orchestration and significant infrastructure/provider choices.

## Documentation policy

Each sprint/release records implemented and verified behavior, exact evidence, deferred work, technical debt, rollback/recovery, ADRs, compatibility and limitations. Architecture-only work explicitly states that runtime behavior is not implemented.

## Release cadence

Planning and Architecture → Focused Implementation → Engineering Validation → Architectural Review → Release Candidate → Community Preview/Beta → General Availability → Maintenance.

The next phase begins from the latest certified and tagged baseline.