# Sprint 03 — Practice & Doctor Management

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

- [ ] Clean frozen-lockfile install passes.
- [ ] TypeScript validation passes.
- [ ] Production build passes.
- [ ] API and frontend start successfully.
- [ ] Practice create, read, update, delete, search, and filtering pass.
- [ ] Doctor create, read, update, delete, search, practice filtering, and status filtering pass.
- [ ] Multiple doctors can be assigned to one practice.
- [ ] Practices with linked doctors cannot be deleted.
- [ ] Communication entries persist for the process lifecycle.
- [ ] Dashboard counts reflect API-backed active records.
- [ ] Playwright Sprint 3 lifecycle passes.

## Out of scope

- Database persistence beyond the current API process.
- Production identity provider changes.
- Case management changes.
- Billing, shipping, or CAD features.
