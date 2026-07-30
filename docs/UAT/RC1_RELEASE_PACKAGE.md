# NorthStar Sprint 13A — Business UAT RC1

## Release identity

- Product: NorthStar
- Release: Sprint 13A Business UAT Release Candidate 1
- Version: 0.13.0
- Build: 0.13.0-rc1
- Migration: 0007
- Branch: `feature/sprint-13a-uat-interactive-platform`
- Environment: Development/UAT only
- Production status: Not certified for Production

The exact commit, workflow runs, timestamps and conclusions are recorded in the final PR certification and must match PR #18's head.

## UAT readiness scope

RC1 provides:

- secure login, logout and session restoration
- Remember This Device
- password-reset request and completion
- role-aware landing pages and navigation
- deterministic UAT personas
- Keramos and Sample Laboratory A tenant boundaries
- operational simulation data
- populated role dashboards
- Executive Command Center preview
- UAT plans, cases, executions and readiness
- defect lifecycle
- controlled screenshot evidence
- feature flags
- migrations, seed utilities and validation workflows

## Release notes

### Added

- Migration 0007 for System Information, feature flags and UAT evidence
- Development/UAT deterministic identity provisioning
- structured UAT workspace
- defect management from New through Closed
- business-walkthrough seed data
- Executive Command Center preview
- tenant-isolation checks
- UAT screenshot evidence through ObjectStorage
- complete role and responsive browser certification coverage
- RC1 installation, credentials and walkthrough documentation
- machine-readable release manifest

### Preserved

All Community Preview 2 authentication, authorization, Communications, Digital Intake, Product Resolution, routing, administration, QC, Shipping, Billing and browser behavior remains subject to inherited regression validation.

## UAT Readiness Report

Readiness requires the exact PR head to pass:

- frozen dependency installation
- strict TypeScript
- production builds
- migrations 0001–0007
- inherited repository, security, Communications and Digital Intake integrations
- `test:uat`
- UAT attachment integration
- migration 0007 rollback and reapplication
- secure API lifecycle
- full Playwright suite

Business UAT begins only after both Runtime Validation and Sprint 13A Validation pass on the same exact head and PR #18 is marked Ready for Review.

## Known issues and limitations

- Platform Owner, Tenant Owner, Tenant Administrator and Office Staff are simulation personas mapped to existing CP2 security roles.
- Sample Laboratory A demonstrates identity, dashboard and isolation behavior; tenant-native operational CRUD is deferred.
- No externally hosted UAT URL is included. RC1 uses the documented local startup path.
- The Executive Command Center is an operational preview, not an analytical warehouse.
- Gross production or invoice values must not be interpreted as recognized accounting revenue.
- General Ledger, Tax Engine, licensing, subscription management, custom branding studio and Workflow Engine are deferred.
- External payment, shipping, scanner, CTI, email and SMS provider integrations are deferred.
- UAT evidence attachments are restricted to approved screenshot formats and size limits.
- The application requires Node.js, pnpm and PostgreSQL/Docker for local RC1 use.

## Build information

The `/api/system/information` endpoint exposes:

- environment
- application and API versions
- build version
- Git commit
- migration version
- build timestamp
- tenant ID

## Rollback

1. Stop the RC1 application.
2. Back up the UAT PostgreSQL database and ObjectStorage records.
3. Apply `apps/api/migrations/0007_uat_foundation.rollback.sql` only when Sprint 13A UAT data may be removed.
4. Restore the Community Preview 2 application revision.
5. Re-run the Community Preview 2 migrations and validation before reopening access.

Migration 0007 rollback deletes UAT plans, executions, defects, evidence associations, feature flags, environment metadata and seed-run evidence.

## Business UAT operating rule

After RC1 certification, feature development stops. Business stakeholders operate NorthStar, execute the walkthrough, record defects and enhancement requests, and provide workflow feedback. Sprint 13B planning begins only after that UAT cycle and an explicit proceed decision.