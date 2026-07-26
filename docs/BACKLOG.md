# Engineering Backlog

## Active

- [ ] Merge PR #2 after review.
- [ ] Replace development-only credentials with production identity and secure server sessions.
- [ ] Add server-side authorization enforcement for protected API resources.

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
