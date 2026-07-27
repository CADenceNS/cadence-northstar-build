# Sprint 03 — Practice & Doctor Management

## Status

Complete. Runtime Validation run `30228005719` passed all acceptance gates on PR #4.

## Objective

Deliver API-backed Practice Management and Doctor Management inside the authenticated CADence NorthStar application.

## Scope

- Practice CRUD with automatic account numbers.
- Doctor CRUD with multiple doctors per practice.
- Search and active/inactive filtering.
- Office manager contact information.
- Practice and doctor notes.
- Communication history.
- API validation and relationship protection.
- Authenticated frontend integration.
- Dashboard active-practice and active-doctor counts.
- Playwright end-to-end verification.

## Acceptance gates

- [x] Clean frozen-lockfile install passes.
- [x] TypeScript validation passes.
- [x] Production build passes.
- [x] API and frontend start successfully.
- [x] Practice create, read, update, delete, search, and filtering pass.
- [x] Doctor create, read, update, delete, search, practice filtering, and status filtering pass.
- [x] Multiple doctors can be assigned to one practice.
- [x] Practices with linked doctors cannot be deleted.
- [x] Communication entries persist for the process lifecycle.
- [x] Dashboard counts reflect API-backed active records.
- [x] Playwright authentication and Sprint 3 management lifecycles pass.

## Contract compatibility resolution

- Updated all legacy Practice seed and form objects to include office-manager details, notes, communication history, and update timestamps.
- Updated all legacy Doctor seed, form, edit, filter, and dashboard paths to use `status` as the single active/inactive source of truth.
- Removed the duplicate Doctor `active` field from shared contracts, API records, and React state.
- Kept required contract fields strict; no required fields were made optional and no `any`, `ts-ignore`, or equivalent bypasses were introduced.

## Out of scope

- Database persistence beyond the current API process.
- Production identity provider changes.
- Case management changes.
- Billing, shipping, or CAD features.