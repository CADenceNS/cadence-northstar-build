# CADence NorthStar owner-preview deployment

This guide prepares a private, non-production owner preview. It does not configure DNS or deploy a service. Use a dedicated CADence hosting workspace and a dedicated preview PostgreSQL database; do not use a Keramos/KAMS workspace, a production database, or private certification data.

## Recommended topology

Use one HTTPS browser origin for the gateway and the built browser assets:

```text
https://preview.cadencenorthstar.com
  ├── /             apps/web/dist/index.html (NorthStar)
  ├── /design-studio.html
  ├── /assets/*     apps/web/dist assets
  ├── /api/*        secure gateway on provider PORT
  └── /health       gateway health check
                    └── 127.0.0.1:NORTHSTAR_INTERNAL_UPSTREAM_PORT durable upstream
                                      └── PostgreSQL (DATABASE_URL)
```

The gateway serves `apps/web/dist` when that directory is present beside the compiled API in the repository layout. Browser requests are already relative to `/api`, so this preserves the current `Secure`, `HttpOnly`, `SameSite=Strict` session cookie and current CSRF origin checks without a cross-site exception. The durable upstream binds only to `127.0.0.1`; only the gateway binds the provider-assigned `PORT` on `0.0.0.0`.

Do not expose the durable upstream or split browser and API traffic across unrelated provider domains. A future `api-preview.cadencenorthstar.com` is permitted only behind a same-origin reverse proxy for `/api`; the browser must continue to call `https://preview.cadencenorthstar.com/api/*`.

## Build and run

The API host must contain the repository build outputs for both browser applications. From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @northstar/web build
pnpm --filter @northstar/api build
pnpm --filter @northstar/api migrate
pnpm --filter @northstar/api start
```

`migrate` is external and applies the existing migrations `0001` through `0010` in order using `DATABASE_URL`; startup never runs migrations. It fails immediately when a migration fails. Run it once per preview release as a controlled deployment step, not per request.

`start` runs `node dist/qc-gateway.js`. The hosting platform supplies `PORT`; set `NORTHSTAR_INTERNAL_UPSTREAM_PORT` to a distinct local port (default `4001`). A collision between the two ports fails startup rather than silently binding the wrong listener. Verify `GET /health` through the public gateway after startup.

## API environment

Copy `apps/api/.env.preview.example` only into the host's secret/environment manager. Never commit its real values.

Required for a production preview:

```text
DATABASE_URL=postgresql://...
NODE_ENV=production
NORTHSTAR_INTERNAL_CONTEXT_SECRET=<generated secret, at least 32 characters>
NORTHSTAR_PUBLIC_ORIGIN=https://preview.cadencenorthstar.com
```

`NORTHSTAR_BOOTSTRAP_PASSWORD` is required only while the existing bootstrap user has no credentials. Supply it only through the host secret manager, sign in with the existing bootstrap administrator identity after migrations/startup, then remove it from the host after successful initialization if that credential has been persisted. No credential is hard-coded by this deployment work.

Existing optional runtime variables are `NORTHSTAR_TENANT_ID`, `DB_POOL_MAX`, `NORTHSTAR_UAT_PASSWORD`, `NORTHSTAR_ENVIRONMENT`, `NORTHSTAR_BUILD_VERSION`, `GIT_COMMIT_SHA`, `BUILD_TIMESTAMP`, and `PORT`. `NORTHSTAR_INTERNAL_UPSTREAM_PORT` is the preview-runtime local listener setting added by this change. Production preview should keep `NORTHSTAR_ENVIRONMENT=production`; do not set `NORTHSTAR_UAT_PASSWORD` unless intentionally using the existing UAT provisioning behavior.

`NORTHSTAR_PUBLIC_ORIGIN` must be the exact browser origin, including `https://` and no path. Production cookies are `Secure`, `HttpOnly`, and `SameSite=Strict`; mutations continue to require the current `X-CSRF-Token` and origin validation.

## Browser application contracts

| Application | Root | Framework | Install / build | Output | API configuration |
| --- | --- | --- | --- | --- | --- |
| NorthStar | `apps/web` | Vite + React | `pnpm install --frozen-lockfile`; `pnpm --filter @northstar/web build` | `apps/web/dist` | No API environment variable: source uses relative `/api` requests. |
| Design Studio | `apps/design-studio` source, built by `apps/web` | React, bundled by Vite from `apps/web/design-studio.html` | Same `@northstar/web` build | `apps/web/dist/design-studio.html` and assets | Same relative `/api` origin and existing entitlement gate. |

Vercel can host the static `apps/web` build, but the current app has no separate API-base configuration. Therefore a standalone Vercel browser deployment is not an approved owner-preview topology until a Vercel rewrite/proxy serves `/api/*` through the exact browser origin. The API itself remains a long-running Node/container service, not a Vercel Express/serverless deployment. A separate CADence Vercel workspace is required before any future Vercel deployment.

## First owner access and future DNS

For an empty preview database, provision host secrets, run the migrations, start the gateway, then sign in at `https://preview.cadencenorthstar.com` as the existing seeded bootstrap administrator `dorianhabet@yahoo.com` using the host-provided `NORTHSTAR_BOOTSTRAP_PASSWORD`; the password is never placed in source or documentation. Remove the bootstrap variable after the credential is persisted. Confirm `/health`, session cookie issuance, a CSRF-protected mutation, tenant isolation, and Platform Admin commercial access through the single preview origin.

After a successful private preview deployment, Namecheap may map `preview.cadencenorthstar.com` to the single public gateway. Reserve `api-preview.cadencenorthstar.com` for a future reverse-proxy design only; do not add DNS or deploy it as part of this guide.
