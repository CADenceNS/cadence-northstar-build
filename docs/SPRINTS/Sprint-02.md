# Sprint 02 — Runtime Authentication Stabilization

## Objective

Unify the application authentication lifecycle around the Express API and verify the protected browser experience without adding product features.

## Scope

- Generate and commit a reproducible pnpm lockfile from a clean install.
- Replace browser-side credential validation with `POST /api/auth/login`.
- Maintain one application-level authentication state.
- Persist the authenticated user across refreshes.
- Protect the application shell and internal navigation when unauthenticated.
- Clear the session and return to login on logout.
- Load dashboard API data only for authenticated users.
- Validate the lifecycle with Playwright.

## Implemented

- React login submits credentials to the Express authentication endpoint.
- Invalid API responses remain on the login screen with an error.
- Successful responses populate the shared session state and browser persistence.
- Refresh restores the authenticated session.
- Logout clears persistence, resets navigation, and exposes only the login screen.
- Dashboard API loading is initiated only while authenticated.
- Browser tests cover invalid login, successful login, refresh persistence, authenticated navigation, logout, and protected-shell behavior.

## Verification gates

- [x] Clean install generates and commits `pnpm-lock.yaml`.
- [x] Subsequent install passes with `--frozen-lockfile`.
- [x] TypeScript validation passes.
- [x] Production build passes.
- [x] API and web services start.
- [x] Playwright authentication lifecycle passes.

Verified by Runtime Validation run `30225100736`.

## Out of scope

- New application features.
- Production identity provider integration.
- Password reset or account administration.
- Token refresh or server-managed session cookies.
