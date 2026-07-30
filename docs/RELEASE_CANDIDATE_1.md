# Community Preview 2 Release Candidate 1

## Release identity

- Version: `v0.2.0`
- Release name: Community Preview 2
- Recommended tag: `v0.2.0-cp2`
- Migration version: `0006_intake_administration.sql`

## Scope

RC-1 consolidates the validated NorthStar platform through Sprint 12, including the final Sprint 11 Communications hardening. It introduces no new ERP functionality.

## Required validation

The exact certification commit must pass:

- frozen dependency installation;
- strict TypeScript;
- shared, API, and React production builds;
- PostgreSQL migrations 0001–0006;
- repository, security, Communications, and Digital Intake integrations;
- rollback and reapplication;
- secure API lifecycle;
- Runtime Validation;
- complete Playwright regression.

## Baseline rule

The validated certification commit is fast-forwarded to `main` without additional application changes. That commit becomes the permanent Community Preview 2 baseline for future development.
