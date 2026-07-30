# NorthStar Project Governance

## Purpose

NorthStar is governed as an enterprise multi-tenant SaaS product for dental laboratories. This document defines the permanent development, validation, architectural-review, release and maintenance lifecycle.

## Official lifecycle

```text
Feature Development
        ↓
Engineering Validation
        ↓
Architectural Review
        ↓
Release Candidate
        ↓
Community Preview
        ↓
Beta, when applicable
        ↓
General Availability
        ↓
Maintenance
```

## Semantic milestones

| Milestone | Meaning |
|---|---|
| Community Preview (CP) | Internally stable, feature-complete milestone for the declared scope and controlled evaluation. |
| Beta | Laboratory business users perform structured UAT against realistic tenant workflows and data. |
| Release Candidate (RC) | Feature freeze; only verified fixes, security, migration, documentation and release engineering changes are allowed. |
| General Availability (GA) | Production-ready release after UAT, operational, security, support, migration and approval gates. |

A milestone name may be used only after its required gates complete.

## Commercial tenant model

- The NorthStar Platform is operated by the Platform Owner.
- A subscribing dental laboratory is a tenant.
- Tenant Owners and Administrators govern their laboratory environment.
- Practices and Doctors are customers of the laboratory, not NorthStar tenants.
- Office users are delegated Practice users.
- Patient access is a future, separately governed portal boundary.

Every architecture review must confirm that platform, tenant, Practice, Doctor and office-user ownership boundaries remain explicit.

## Multi-tenant design requirements

Every new domain must document:

- tenant ownership and tenant-resolution source;
- Practice/entity authorization where applicable;
- cross-tenant denial tests;
- tenant-safe ObjectStorage, cache, queue, event and analytics keys;
- support-access behavior;
- suspension, export, retention and deletion behavior;
- per-tenant limits and noisy-neighbor protections;
- whether configuration is Platform-owned or Tenant-owned.

Platform Owner access never implies unrestricted tenant data access. Support access requires explicit scope, reason, approval, expiration and immutable audit.

## Branch policy

- Use short-lived, focused branches from the latest certified baseline.
- Target `main` or one approved integration branch.
- Avoid long-lived stacks.
- Keep pull requests independently reviewable.
- Update with the target before final validation.
- Archive integrated branches after preserving PR, commit, tag and release traceability.
- Do not begin a major phase until the prior milestone is certified and tagged.

## Merge policy

A pull request may merge only when its final head is current and:

- required reviews complete;
- strict TypeScript and production builds pass;
- migrations, rollback and reapplication pass when applicable;
- repository, security, tenant-isolation and domain integrations pass;
- Runtime Validation passes;
- complete Playwright regressions pass;
- documentation and ADRs are current;
- deferred work and technical debt are explicit;
- no unresolved security or architectural concern remains.

Validation from an older commit does not certify a newer head.

## Architecture policy

Review domain ownership, layer separation, tenant isolation, authorization, persistence, events, APIs, migration safety, coupling, duplication, scalability and provider boundaries. Significant decisions require ADRs.

Branding, subscription entitlements, feature flags, hostnames and UI visibility are never authorization controls. Cross-domain coordination uses commands and events; one domain does not write another domain’s source tables.

## Release policy

### Feature Development

New functionality is permitted. Architecture, security, tests, documentation and migrations evolve together.

### Engineering Validation

The branch passes deterministic automated validation without weakening production controls.

### Architectural Review

Review the permanent boundaries and require ADRs for significant decisions.

### Release Candidate

Feature freeze permits only verified defects, security/authorization corrections, migration/rollback corrections, production-preserving test corrections, documentation and release engineering. Every RC identifies commit, migration version, validation, limitations and rollback.

### Community Preview

Requires an integrated primary branch, release notes, version/tag, current validation, ADR completeness and baseline manifest.

### Beta

Adds structured UAT by laboratory business users, realistic tenant scenarios, defect triage, approvals and operational-readiness review.

### General Availability

Requires deployment, support, incident response, backup/recovery, monitoring, retention, privacy, security and formal commercial-readiness approval.

### Maintenance

Uses small branches and patch releases; compatibility changes require approved migration strategy.

## Validation requirements

Every RC and stable milestone includes:

- frozen dependency installation;
- strict TypeScript and production builds;
- all migrations and changed rollback/reapplication;
- repository/domain integrations;
- authentication, authorization and tenant-isolation tests;
- Runtime Validation;
- complete Playwright regression;
- documentation/ADR validation;
- exact-final-commit evidence.

Validation should be read-only and must not silently modify source or lockfiles.

## ADR requirements

An ADR is required for new domains, ownership changes, long-term integrations, persistence/events, authorization/tenant strategy, compatibility/deprecation, orchestration, commercial-control boundaries, provider abstractions and significant infrastructure.

ADRs record context, decision, consequences, alternatives, status and supersession. They do not replace tests or implementation documentation.

## Documentation policy

Each sprint/release documents implemented and verified behavior, exact evidence, deferred work, technical debt, rollback, ADRs, compatibility and limitations. Architecture-only work must say explicitly that runtime behavior is not implemented.

## Release cadence

1. Planning and architecture
2. Focused implementation
3. Engineering validation
4. Architectural review
5. Release Candidate and feature freeze
6. Community Preview or Beta
7. General Availability when gates pass
8. Maintenance and patch releases

The next phase begins from the latest certified and tagged baseline.