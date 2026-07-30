# NorthStar Project Governance

## Purpose

NorthStar is governed as an enterprise software product. This document defines the permanent development, validation, architectural-review, release, and maintenance lifecycle.

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
| --- | --- |
| Community Preview (CP) | Internally stable, feature-complete milestone for the declared scope. Suitable for controlled internal use and architectural evaluation. |
| Beta | Internal business users perform structured UAT against realistic workflows and data. Defects and operational feedback drive stabilization. |
| Release Candidate (RC) | Feature freeze. Only verified defect corrections, security corrections, documentation, migration corrections, and release-engineering work are allowed. |
| General Availability (GA) | Production-ready release after UAT, operational readiness, security review, migration verification, support readiness, and release approval. |

A milestone name must not be used until its required validation and approval gates are complete.

## Branch policy

- Use short-lived, focused branches.
- Target `main` or one explicitly approved integration branch.
- Avoid long-lived stacked branches except when a documented dependency makes them unavoidable.
- Keep each pull request independently reviewable and small enough for meaningful architectural and security review.
- Rebase or update before final validation when the target branch changes.
- Delete or archive integrated branches after preserving traceability through commits, pull requests, tags, and release notes.
- Do not begin a new major phase until the previous milestone is tagged and certified.

## Merge policy

A pull request may merge only when:

- its final head is current with the target branch;
- required reviews are complete;
- strict TypeScript and production builds pass;
- applicable migrations, rollback, and reapplication pass;
- repository, security, domain, and integration tests pass;
- Runtime Validation passes;
- complete Playwright regressions pass;
- documentation and ADRs are current;
- deferred work and technical debt are explicit;
- no unresolved security or architectural concern remains.

Validation from an older commit does not certify a newer head.

## Release policy

### Feature Development

New functionality is permitted. Scope, architecture, tests, documentation, and migrations evolve together.

### Engineering Validation

The branch must pass deterministic automated validation. Failures must be corrected without weakening production controls.

### Architectural Review

Review domain ownership, module boundaries, authorization, persistence, event contracts, API behavior, migration safety, coupling, duplication, and long-term integration strategy.

Significant decisions require ADRs.

### Release Candidate

Feature freeze begins. Allowed changes are limited to:

- verified defect corrections;
- security and authorization corrections;
- migration and rollback corrections;
- test-alignment corrections that preserve production behavior;
- documentation and release engineering.

Every RC must identify its exact commit, migration version, validation evidence, known limitations, and rollback strategy.

### Community Preview

A CP is a stable internal milestone. It requires an integrated primary branch, release notes, a version and tag, current validation evidence, ADR completeness, and a baseline manifest.

### Beta

Beta adds structured UAT by internal business users, realistic test data, defect triage, release approvals, and operational-readiness review.

### General Availability

GA requires production deployment readiness, support and incident processes, backup and recovery validation, security approval, operational monitoring, data-retention controls, and formal release approval.

### Maintenance

Maintenance changes use small branches and preserve compatibility unless an approved migration plan states otherwise. Hotfixes require regression validation and a patch release.

## Validation requirements

Every release candidate and stable milestone must include:

- frozen dependency installation;
- strict TypeScript;
- shared, API, and frontend production builds;
- all PostgreSQL migrations;
- rollback and reapplication for changed migrations;
- repository and domain integration tests;
- security and authorization tests;
- Runtime Validation;
- complete Playwright regression;
- release-document and ADR validation;
- validation on the exact final commit.

Runtime and release validation should be read-only. Workflows must not silently modify source files or dependency locks.

## ADR requirements

An ADR is required when work:

- introduces a new domain;
- changes module ownership or boundaries;
- defines a long-term integration strategy;
- changes persistence or event architecture;
- changes authorization or tenant-isolation strategy;
- establishes compatibility or deprecation policy;
- introduces a cross-domain workflow or orchestration model;
- adopts a significant infrastructure provider or abstraction.

ADRs record context, decision, consequences, alternatives, status, and supersession relationships. They do not replace implementation documentation or tests.

## Documentation policy

Each sprint or release must document:

- implemented and verified behavior;
- exact final validation evidence;
- deferred work;
- technical debt;
- migration and rollback considerations;
- architecture decisions and ADR references;
- compatibility and known limitations.

Unverified functionality must never be described as complete.

## Release cadence

NorthStar adopts this repeatable cadence:

1. Sprint planning and architecture
2. Focused implementation
3. Engineering validation
4. Architectural review
5. Release Candidate and feature freeze
6. Community Preview or Beta milestone
7. General Availability when readiness gates are satisfied
8. Maintenance and patch releases

The next major development phase must begin from the latest certified and tagged baseline.
