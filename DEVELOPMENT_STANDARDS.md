# CADence NorthStar Development Standards

## 1. Branching and Changes

Preferred workflow:

- `main` is always expected to be releasable.
- Work is completed in `feature/*`, `fix/*`, `docs/*`, or `chore/*` branches.
- Changes reach `main` through reviewed pull requests once branch protection is enabled.
- Direct production code uploads through the GitHub website should be temporary, not the permanent workflow.

## 2. Commit Messages

Use Conventional Commits:

```text
feat: add practice creation API
fix: prevent case shipment before QC approval
docs: add platform architecture
test: cover turnaround holiday rules
chore: configure CI
```

Each commit should represent one coherent change.

## 3. Versioning

Use semantic versioning:

- Patch: compatible fixes
- Minor: compatible features
- Major: breaking changes

Update the changelog for every release. Create Git tags for verified releases.

## 4. TypeScript

- Enable strict mode.
- Avoid `any`.
- Validate unknown external values before use.
- Prefer explicit domain types and narrow unions.
- Keep shared contracts framework-independent.
- Do not duplicate business enums across applications.
- Do not silence compiler errors without a documented reason.

## 5. Code Organization

- Keep React components focused on presentation and interaction.
- Keep business logic in services or domain modules.
- Keep route handlers thin.
- Avoid direct database access from UI code.
- Avoid large all-in-one source files.
- Use descriptive names rather than abbreviations.
- Remove dead code before merging.

## 6. Validation and Errors

- Validate environment variables at startup.
- Validate every API request.
- Return stable error codes.
- Do not expose stack traces or secret values to clients.
- Log unexpected errors with request context.
- Show users actionable error messages.

## 7. Security

- Never commit real passwords, tokens, certificates, patient names, or protected health information.
- Store secrets only in approved environment or secret-management systems.
- Enforce permissions on the server.
- Apply organization scope to all tenant-owned queries.
- Use least privilege.
- Audit sensitive actions.
- Review dependencies and security alerts regularly.

## 8. Database

- Every schema change requires a migration.
- Migrations must be reviewed before deployment.
- Seed scripts must use fictional data.
- Historical records should generally be archived rather than deleted.
- Use transactions for multi-record critical operations.
- Add indexes for foreign keys and common filters.
- Use UTC timestamps in storage.

## 9. Testing Requirements

Before merge:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Minimum expectations:

- New business rules include unit tests.
- New API endpoints include integration tests.
- Permission-sensitive changes include authorization tests.
- Bug fixes include a regression test when practical.
- Critical workflows receive end-to-end coverage.

## 10. Pull Request Requirements

A pull request should state:

- Problem
- Solution
- Scope
- Tests performed
- Screenshots for visible changes
- Migration impact
- Security or privacy impact
- Rollback plan where relevant

A pull request should not be merged with unresolved required checks.

## 11. CI Quality Gates

GitHub Actions should:

1. Install the pinned pnpm version.
2. Use the supported Node.js version.
3. Restore dependency cache.
4. Install with a frozen lockfile.
5. Validate formatting or linting.
6. Run type checking.
7. Run tests.
8. Build all packages.
9. Validate Prisma schema and migrations.
10. Report failures clearly.

## 12. Documentation

Update documentation when changing:

- Architecture
- Business rules
- Public API behavior
- Environment variables
- Database schema
- Workflow
- Deployment
- User-visible operation

Architecture decisions should be recorded as ADRs rather than buried in chat or commit messages.

## 13. Definition of Done

A change is complete when:

- Requirements are met.
- Code is reviewed.
- Validation is implemented.
- Permissions are enforced.
- Tests pass.
- Type checking passes.
- Build passes.
- Documentation is current.
- Audit behavior is correct.
- No real sensitive data is included.
- The change can be rolled back or recovered safely.
