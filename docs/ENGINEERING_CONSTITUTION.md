# CADence NorthStar Engineering Constitution

## Authority

This document defines mandatory engineering policy for every future CADence NorthStar sprint, maintenance change, migration, release, integration, and service extraction. A pull request may not weaken these rules implicitly. Exceptions require a written Architecture Decision Record, named owner, bounded duration, risk analysis, and removal plan.

## Core commitments

1. Preserve verified business behavior unless the sprint explicitly changes it.
2. Keep strict TypeScript and do not bypass the type system with broad casts, `any`, or disabled checks.
3. Put business rules in one authoritative application/domain location.
4. Keep infrastructure behind typed interfaces.
5. Treat tenant isolation, authorization, auditability, migrations, and rollback as product requirements.
6. Prove changes through automated validation before declaring them complete.
7. Report only verified findings.

## Branching strategy

- Protected integration branches are never used for direct feature development.
- Each sprint or independently reviewable change uses a focused feature branch.
- Branch names use a stable form such as `feature/<milestone>-<scope>`, `fix/<scope>`, or `docs/<scope>`.
- Stacked branches are allowed when prior work has not merged, but each pull request must identify its base and merge order.
- A branch contains one coherent objective. Unrelated cleanup is deferred or split.
- Force pushes to shared review branches are avoided unless needed to repair history and coordinated with reviewers.
- Release branches and tags follow `RELEASE_STRATEGY.md`.

## Pull request requirements

Every pull request must include:

- Problem or objective
- Implemented scope
- Explicit non-goals
- Architectural impact
- Data and migration impact
- Security and tenant-isolation impact
- Validation evidence with workflow run identifiers
- Rollback considerations
- Deferred work and known limitations
- Base branch and sequencing when stacked

Pull requests begin as drafts when implementation or validation is incomplete. Draft status is removed only after all required gates pass on the final head.

No pull request may claim completion based on an earlier commit when newer unvalidated commits exist.

## Review requirements

- At least one qualified reviewer for normal changes.
- Architecture review for new services, new infrastructure providers, public contract changes, cross-domain writes, or persistence changes.
- Security review for identity, authorization, tenant isolation, secrets, file ingestion, external portals, or clinical data handling.
- Clinical/domain review for restoration, QC, preparation, margin, occlusion, or AI-assisted clinical behavior.
- Database review for migrations, constraints, large backfills, indexes, or destructive operations.
- Unresolved review threads block readiness.

## CI requirements

The standard CI pipeline must include, as applicable:

- Frozen-lockfile installation
- Strict TypeScript validation
- Production builds
- Unit and component tests
- Repository contract tests
- PostgreSQL integration tests
- Migration apply tests
- Rollback and reapplication tests
- Object-storage tests
- Static analysis and dependency scanning as introduced
- Playwright regression tests

A red required check blocks completion. Flaky tests are defects; they are fixed or quarantined with an owner and deadline, never ignored indefinitely.

## Runtime validation requirements

Runtime Validation is independent of compile-time CI and must prove that built services operate together.

It must verify:

- Required infrastructure starts successfully
- Migrations are applied to a clean environment
- API health and readiness
- Frontend startup
- Authentication and session lifecycle
- Representative cross-module workflows
- Durable persistence across process restart for persistence-sensitive changes
- Required logs and diagnostics are retained on failure
- Production configuration does not silently fall back to in-memory storage

## Playwright requirements

- Existing Playwright regressions remain mandatory for every production change.
- New user-visible workflows require a complete browser lifecycle test.
- Tests use public UI and API surfaces rather than internal implementation shortcuts, except for deterministic setup where documented.
- Tests must be isolated, repeatable, and able to run on a clean environment.
- Selectors favor accessible roles and stable test identifiers, not fragile CSS structure.
- Browser failures must produce traces, screenshots, logs, or equivalent diagnostics.
- Documentation-only changes still run the unchanged browser suite before closeout.

## Repository standards

- Use the monorepo boundaries defined in `MASTER_ARCHITECTURE.md`.
- Application/domain code does not import vendor infrastructure clients.
- Public contracts are versioned and owned.
- Shared packages expose stable contracts; they do not become dumping grounds for unrelated helpers.
- Circular dependencies are prohibited.
- Module internals are not imported across domains; use public application interfaces.
- File and class names express domain purpose.
- Generated files are reproducible and not manually edited unless documented.
- Secrets, credentials, private keys, and production data are never committed.

## Documentation requirements

Every sprint updates:

- `docs/BACKLOG.md`
- Its sprint or milestone document
- Relevant architecture, database, module, release, and operational documentation
- ADRs for material architectural decisions

Documentation must distinguish:

- Implemented
- Verified
- Deferred
- Blocked
- Rollback implications

Documentation is reviewed as code and validated on the same final head.

## Definition of Done

A change is **Done** only when:

- Scope and acceptance criteria are implemented.
- Business behavior is preserved or intentionally changed and documented.
- Strict type checking and production build pass.
- Required tests are present and pass.
- Migrations and rollback paths are documented and tested.
- Security, tenant, audit, and object-storage requirements are satisfied.
- Documentation is current.
- No unresolved blocker remains.
- The final pull request head has passed required CI and Runtime Validation.

Implementation without validation is not Done.

## Definition of Verified

A finding or capability is **Verified** only when objective evidence exists on the exact referenced commit. Acceptable evidence includes:

- Successful CI workflow
- Successful Runtime Validation workflow
- Passing Playwright suite
- Passing repository or migration integration test
- Reproducible database or object-storage assertion
- Reviewed artifact or measured operational result

Manual confidence, code inspection alone, or success on an older commit is not sufficient.

## Architectural principles

- Modular monolith first; service extraction by evidence.
- Dependency direction points inward toward domain contracts.
- PostgreSQL is the transactional system of record.
- ObjectStorage owns production file bytes.
- Immutable audit events accompany authenticated mutations.
- Cross-module consistency uses transactions or explicit sagas.
- External effects are idempotent and retry-safe.
- Compatibility is preserved through versioned contracts and migrations.
- Clinical and AI outputs preserve provenance and require appropriate human review.
- Observability is designed with the feature, not added after failure.

## Coding standards

### TypeScript

- `strict` mode remains enabled.
- Avoid `any`; use unknown plus validation.
- Validate external input at transport boundaries.
- Model finite states with unions or enums.
- Prefer exhaustive checks for lifecycle transitions.
- Distinguish identifiers and monetary values through clear types where practical.
- Async errors are handled and translated into stable API responses.

### Application design

- Handlers remain thin.
- Use cases own authorization, validation orchestration, transaction boundaries, audit emission, and event publication.
- Domain rules are deterministic and testable without infrastructure.
- Repository interfaces represent domain needs, not raw table access.
- Duplicate business logic across API, UI, worker, or integration code is prohibited.

### Database

- Migrations are ordered, reviewable, and paired with rollback or restore instructions.
- Constraints enforce critical invariants.
- Indexes correspond to measured or clearly defined access paths.
- Financial data uses exact decimal persistence.
- Soft deletion is used only when retention or referential requirements justify it.
- Large backfills are restartable, observable, and safe under concurrent operation.

### APIs

- Stable error shapes
- Explicit authentication and authorization
- Tenant resolution on every protected request
- Pagination for unbounded collections
- Idempotency for retryable mutations
- Correlation IDs
- Versioning for breaking public changes
- No exposure of internal object keys, credentials, or stack traces

### UI

- Accessible semantic controls
- Responsive behavior for supported form factors
- Server remains authoritative for business rules
- Loading, empty, error, success, and permission states are represented
- Feature folders own their UI, hooks, API access, and tests

## Testing philosophy

Testing is layered:

1. **Domain tests** validate rules and state machines quickly.
2. **Application tests** validate orchestration, authorization, audit, and transactions.
3. **Repository integration tests** validate PostgreSQL behavior and isolation.
4. **Contract tests** validate public APIs, providers, and events.
5. **Component tests** validate complex UI behavior.
6. **Playwright tests** validate complete user workflows.
7. **Runtime Validation** validates the deployed composition.
8. **Performance, security, and recovery tests** validate operational readiness.

No single layer replaces the others.

## Security and privacy standards

- Least privilege by default.
- Authorization is enforced server-side.
- Tenant identifiers are never trusted solely from client input.
- Clinical and personal data are minimized in logs.
- Sensitive files use controlled access and retention.
- Uploads are validated, checksummed, scanned, and quarantined when external ingestion is introduced.
- Audit history is protected from ordinary mutation paths.
- Dependency, secret, and vulnerability scanning become required before General Availability.

## Migration and rollback policy

- Back up before destructive or irreversible changes.
- Test fresh creation, upgrade, rollback, reapplication, and representative backfill.
- State clearly when rollback requires backup restoration.
- Application deployment and schema migration order must support safe rollout.
- Compatibility windows use expand/migrate/contract sequencing.
- Emergency rollback procedures are documented before production release.

## Dependency policy

- Production dependencies use controlled version ranges and committed lockfiles.
- Major upgrades receive dedicated review and regression validation.
- Automated update tooling may propose changes but cannot bypass tests.
- Abandoned or high-risk dependencies receive replacement plans.
- Native CAD, imaging, or AI dependencies are isolated behind service boundaries where practical.

## Observability policy

Each production service and worker provides:

- Structured logs
- Metrics
- Traces or correlation propagation
- Health and readiness endpoints
- Error classification
- Dependency timing
- Queue and job visibility
- Audit linkage where relevant

Alerts must map to an owner and runbook.

## Architectural decision records

Create an ADR for:

- New service or database
- New cloud provider or external platform
- Public API or event-contract break
- New identity or authorization model
- New cross-domain transaction strategy
- New clinical or AI decision capability
- Deliberate constitutional exception

ADRs are immutable historical records; superseded ADRs remain and point to replacements.

## Completion reporting

Final reports use only these categories when requested:

- Implemented
- Verified
- Deferred
- Blocked
- Final PR status

Statements must identify whether evidence applies to the latest head. Future work is never described as already implemented.
