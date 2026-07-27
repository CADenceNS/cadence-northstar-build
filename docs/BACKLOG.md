# Engineering Backlog

## Active

- [ ] Merge PR #2 after review.
- [ ] Review and merge PR #4 after PR #2.
- [ ] Replace development-only credentials with production identity and secure server sessions.
- [ ] Add server-side authorization enforcement for protected API resources.
- [ ] Replace process-memory Practice and Doctor storage with database persistence.

## Completed — Sprint 3 Practice & Doctor Management

- [x] Define shared Practice, Doctor, office-manager, notes, and communication contracts.
- [x] Add Practice CRUD, search, status filtering, validation, account generation, and communication API endpoints.
- [x] Add Doctor CRUD, search, practice/status filtering, validation, and communication API endpoints.
- [x] Protect practice deletion when doctors remain linked.
- [x] Build authenticated Practice Management and Doctor Management pages.
- [x] Add dashboard counts backed by active API records.
- [x] Remove duplicate Doctor active-state representation and use `status` exclusively.
- [x] Align legacy Practice and Doctor seed data, default forms, edit flows, and UI state with strict Sprint 3 contracts.
- [x] Add Playwright authentication and management lifecycle coverage.
- [x] Pass frozen install, typecheck, production build, API startup, web startup, and Playwright verification in Runtime Validation run `30227945017`.
- [x] Open focused Sprint 3 pull request #4 stacked on PR #2.

## Completed in PR #2

- [x] Establish executable API and web startup validation.
- [x] Route React login through `POST /api/auth/login`.
- [x] Keep authentication in one application-level session state.
- [x] Persist the authenticated user across browser refreshes.
- [x] Protect the application shell and internal views when no session exists.
- [x] Clear authentication state and return to login on logout.
- [x] Load dashboard API data only after authentication.
- [x] Add Playwright coverage for invalid login, successful login, persistence, authenticated navigation, logout, and protected-shell behavior.
- [x] Commit a generated `pnpm-lock.yaml` from a successful clean install.
- [x] Verify a subsequent install with `--frozen-lockfile`.
- [x] Record passing typecheck, build, API startup, web startup, and Playwright authentication results.