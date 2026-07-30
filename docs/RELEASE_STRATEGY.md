# CADence NorthStar Release Strategy

## Purpose

This document defines how CADence NorthStar moves from internal development through Community Preview, Beta, Release Candidate, and General Availability. It governs versioning, migrations, compatibility, rollback, release evidence, and support expectations.

## Release channels

### Development

Used for active engineering work.

- No stability guarantee
- Feature branches and draft pull requests
- Local or ephemeral infrastructure
- Data may be reset
- Required engineering checks still apply before merge

### Preview environment

Used for integrated milestone validation and selected stakeholder review.

- Production-like configuration
- Controlled test data or approved representative data
- Automated deployment
- Migrations applied exactly as intended for production
- Observability and rollback diagnostics enabled

### Community Preview

A Community Preview demonstrates a coherent platform milestone to selected users while explicitly limiting production guarantees.

Required characteristics:

- Defined user and workflow scope
- Documented limitations
- Durable upgrade path or explicit reset policy
- CI, Runtime Validation, and Playwright evidence
- Security and data-handling statement
- Feedback and issue intake process

Community Preview releases may introduce contract changes, but changes must be documented and accompanied by migrations when retained data is supported.

### Beta

Beta indicates that the intended product shape is substantially present and undergoing broader hardening.

Required characteristics:

- Stable core workflows
- Production-style identity and authorization
- Durable persistence and object storage
- Operational monitoring and recovery procedures
- Versioned public contracts
- Performance and security baselines
- Upgrade testing from supported previews

Breaking changes require an approved migration plan and release notes.

### Release Candidate

A Release Candidate is a production-intent build. New feature scope is frozen except for release-blocking corrections.

Required characteristics:

- Complete planned GA scope
- No unresolved critical or high-severity release blockers
- Migration and rollback rehearsal
- Disaster recovery exercise
- Security review
- Accessibility and browser qualification
- Load and reliability testing
- Support, incident, and deployment runbooks
- Final compatibility review

A new Release Candidate is issued after material code, migration, or configuration changes.

### General Availability / Production

General Availability is the supported production release.

Required characteristics:

- Approved release checklist
- Supported deployment architecture
- Documented service objectives
- Backup, restore, monitoring, alerting, and incident response
- Supported upgrade and rollback path
- Customer-facing release notes
- Defined support and deprecation policy

## Milestone naming

The planned sequence is:

1. Community Preview 1 Beta — durable ERP foundation, achieved
2. Community Preview 2 — identity, authorization, operations, communications
3. Community Preview 3 — scanner gateway, Doctor Portal, cloud objects, jobs
4. Beta — imaging, mesh, manufacturing foundations, broader hardening
5. Release Candidate — clinical analysis, enterprise readiness, release freeze
6. General Availability — supported production platform

Additional previews or release candidates may be inserted when risk or scope requires them.

## Versioning strategy

### Before General Availability

Use semantic-style pre-release versions:

- `0.<milestone>.<patch>-cp.<n>` for Community Preview builds
- `0.<milestone>.<patch>-beta.<n>` for Beta builds
- `1.0.0-rc.<n>` for Release Candidates

Example progression:

```text
0.9.0-cp.1
0.10.0-cp.2
0.11.0-cp.3
0.12.0-beta.1
1.0.0-rc.1
1.0.0
```

The exact package version is less important than consistent release tags, immutable artifacts, migration ordering, and release notes.

### After General Availability

Use Semantic Versioning:

- **MAJOR** — intentional incompatible public contract or data behavior change
- **MINOR** — backward-compatible capability
- **PATCH** — backward-compatible correction or maintenance

Database schema versions remain migration-based and do not need to equal application versions.

## Release branches and tags

- Feature work remains on focused branches.
- Integration occurs through reviewed pull requests.
- Release stabilization may use `release/<version>` branches.
- Release tags are signed or otherwise protected when operationally available.
- A tag points to the exact validated commit.
- Build artifacts are immutable and associated with commit, version, migration set, and configuration manifest.

## Release candidate process

1. Define release scope and freeze date.
2. Confirm dependency and migration inventory.
3. Deploy to staging using production process.
4. Restore representative data or import a qualified snapshot.
5. Apply migrations and backfills.
6. Run CI, integration, Runtime Validation, and full Playwright.
7. Run performance, security, accessibility, and recovery qualification.
8. Rehearse rollback.
9. Publish candidate notes and known limitations.
10. Approve or reject the candidate.

Any material change after approval produces a new candidate and repeats affected gates.

## Migration strategy

### Principles

- Migrations are ordered, reviewed, and automated.
- Fresh creation and upgrade paths are both tested.
- Representative backfills are tested for correctness and restartability.
- Application and schema changes support safe deployment order.
- Large migrations expose progress and failure diagnostics.
- Backups are verified before destructive operations.

### Expand, migrate, contract

For changes requiring compatibility across deployments:

1. **Expand** — add new nullable fields, tables, indexes, or compatible endpoints.
2. **Migrate** — backfill and dual-read or dual-write only when necessary and explicitly bounded.
3. **Switch** — move authoritative reads/writes after parity validation.
4. **Contract** — remove deprecated paths in a later release after the compatibility window.

Avoid one-step destructive schema changes in production.

### Data and object migration

- Preserve stable identifiers where possible.
- Reconcile entity counts, relationships, balances, checksums, and audit totals.
- Object migrations verify byte count, checksum, ownership, and retention metadata.
- Failed migrations are resumable or safely restartable.
- Migration reports are retained with release evidence.

## Rollback philosophy

Rollback is a designed operational capability, not an improvised response.

### Application rollback

- Previous immutable artifacts remain available.
- Configuration compatibility is documented.
- Feature flags may disable new behavior when safe.
- Rolling deployments preserve compatibility with the active schema.

### Database rollback

- Rollback scripts are used only when they preserve data safely.
- Destructive rollback requires restoration from a verified pre-migration backup.
- Point-in-time recovery is preferred for production data loss scenarios.
- Forward-fix may be safer than rollback after new writes occur; the decision is explicit and incident-led.

### Object rollback

- Object backups, versioning, or replication are required when migration changes object keys or bytes.
- Database rollback alone does not restore object content.
- Referential reconciliation follows restore.

## Compatibility policy

### User workflows

Verified workflows remain compatible within a release channel unless release notes explicitly identify a migration or changed behavior.

### APIs

- Breaking public API changes require versioning or an approved compatibility window.
- Additive fields are preferred.
- Unknown fields should not break tolerant clients where safe.
- Error contracts remain stable.
- Deprecated endpoints include replacement guidance and removal milestone.

### Events

- Event schemas are versioned.
- Consumers tolerate additive changes.
- Breaking event changes use a new event version or parallel topic/contract.
- Replay and idempotency behavior is documented.

### Database

Applications support the schema versions required during rolling deployment. Direct external database integration is unsupported unless explicitly contracted.

### Files and derived artifacts

Original files remain immutable. Derived artifacts include format, producer version, source references, checksum, and creation time.

## Feature flags and staged rollout

Feature flags are used for controlled exposure, not permanent architectural branching.

A flag includes:

- Owner
- Purpose
- Default state by environment
- Metrics and rollback condition
- Expiration or removal milestone

High-risk capabilities may use internal, selected-tenant, percentage, and general stages.

## Release evidence

Each milestone retains:

- Final commit and tag
- Pull requests included
- CI and Runtime Validation run identifiers
- Playwright results
- Migration and rollback results
- Security and dependency reports as applicable
- Performance and recovery results as applicable
- Release notes
- Known limitations and deferred work
- Approval record

## Release notes

Release notes distinguish:

- New capabilities
- Changed behavior
- Corrections
- Security changes
- Migration requirements
- Compatibility and deprecations
- Known limitations
- Rollback considerations

Internal architectural changes are described by operational impact, not overstated as product functionality.

## Hotfix strategy

- Hotfix branches start from the affected supported release.
- Scope is minimal and directly related to the incident.
- Required type, build, migration, runtime, and focused regression gates still apply.
- Risk-based exceptions require incident authority and immediate follow-up validation.
- The fix is merged forward into active development branches.

## Support windows

Before GA, support is milestone-specific and documented with each preview.

After GA:

- Current minor release receives full support.
- Prior supported versions receive a defined security and migration window.
- End-of-support dates are announced before removal.
- Critical data migration paths are maintained for supported upgrades.

## Release governance

A release cannot advance channels solely because implementation is complete. Advancement requires evidence appropriate to its risk:

- Engineering approval
- Product scope approval
- Architecture approval
- Security approval
- Clinical review when applicable
- Operations/recovery approval for RC and GA

The Engineering Constitution remains mandatory at every release stage.
