# NorthStar RC1 — Installation and Startup Guide

## Purpose

This guide opens the Sprint 13A Business UAT Release Candidate on a Windows computer from a clean repository checkout. It is intended for a business stakeholder and does not require application-development knowledge.

## Included

- NorthStar frontend and secure API gateway
- PostgreSQL migrations 0001 through 0007
- deterministic Keramos and Sample Laboratory A UAT identities
- business-walkthrough seed utility
- role-aware dashboards
- Executive Command Center preview
- UAT plans, executions, defects and evidence attachments

## Required software

1. Git for Windows
2. Node.js 20 LTS
3. Docker Desktop with the WSL 2 backend
4. Windows PowerShell 7 or Windows PowerShell 5.1

## First-time setup

1. Open PowerShell.
2. Clone the repository and enter it:

```powershell
git clone https://github.com/CADenceNS/cadence-northstar-build.git
cd cadence-northstar-build
git checkout feature/sprint-13a-uat-interactive-platform
```

3. Enable pnpm:

```powershell
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

4. Start PostgreSQL:

```powershell
docker run --name northstar-uat-postgres `
  -e POSTGRES_USER=northstar `
  -e POSTGRES_PASSWORD=northstar `
  -e POSTGRES_DB=northstar_uat `
  -p 5432:5432 `
  -d postgres:16
```

If the container already exists, use:

```powershell
docker start northstar-uat-postgres
```

5. Set the UAT environment for the current PowerShell window:

```powershell
$env:DATABASE_URL='postgresql://northstar:northstar@127.0.0.1:5432/northstar_uat'
$env:NORTHSTAR_TENANT_ID='00000000-0000-0000-0000-000000000001'
$env:NORTHSTAR_BOOTSTRAP_PASSWORD='<set-the-approved-bootstrap-password>'
$env:NORTHSTAR_UAT_PASSWORD='<set-the-approved-UAT-password>'
$env:NORTHSTAR_ENVIRONMENT='uat'
$env:NORTHSTAR_BUILD_VERSION='0.13.0-rc1'
$env:GIT_COMMIT_SHA=(git rev-parse HEAD)
```

Do not use UAT passwords in Production.

6. Install NorthStar:

```powershell
pnpm install --frozen-lockfile
```

7. Apply migrations:

```powershell
$migrations = @(
 '0001_infrastructure_core.sql','0002_repository_documents.sql','0003_identity_security.sql',
 '0004_clinical_communications.sql','0005_digital_intake_platform.sql',
 '0006_intake_administration.sql','0007_uat_foundation.sql'
)
foreach ($migration in $migrations) {
 Get-Content "apps/api/migrations/$migration" | docker exec -i northstar-uat-postgres psql -U northstar -d northstar_uat -v ON_ERROR_STOP=1
}
```

8. Start NorthStar:

```powershell
pnpm dev
```

Keep the PowerShell window open.

9. Open the login page:

`http://127.0.0.1:5173`

10. Sign in as Tenant Owner, open **UAT Workspace**, and select **Load deterministic scenarios**. This loads the repeatable business-walkthrough data.

## Daily startup

```powershell
cd cadence-northstar-build
git checkout feature/sprint-13a-uat-interactive-platform
docker start northstar-uat-postgres
$env:DATABASE_URL='postgresql://northstar:northstar@127.0.0.1:5432/northstar_uat'
$env:NORTHSTAR_TENANT_ID='00000000-0000-0000-0000-000000000001'
$env:NORTHSTAR_BOOTSTRAP_PASSWORD='<approved-bootstrap-password>'
$env:NORTHSTAR_UAT_PASSWORD='<approved-UAT-password>'
$env:NORTHSTAR_ENVIRONMENT='uat'
$env:NORTHSTAR_BUILD_VERSION='0.13.0-rc1'
$env:GIT_COMMIT_SHA=(git rev-parse HEAD)
pnpm dev
```

## Stop NorthStar

Press `Ctrl+C` in the NorthStar PowerShell window. Optionally stop PostgreSQL:

```powershell
docker stop northstar-uat-postgres
```

## Troubleshooting

- **Docker reports that the container name already exists:** run `docker start northstar-uat-postgres`.
- **Port 5432 is already in use:** stop the other PostgreSQL service or change both the Docker port and `DATABASE_URL`.
- **Port 4000 or 5173 is in use:** close the previous NorthStar terminal and run `pnpm dev` again.
- **Login does not work:** verify `NORTHSTAR_ENVIRONMENT=uat` and that the configured UAT password matches the credential manifest.
- **Blank or stale page:** press `Ctrl+F5` and sign in again.
- **Database needs a clean reset:** delete and recreate only the Development/UAT container. Never use this procedure for Production.

## Fresh-install verification

The CI release pipelines reproduce installation, typecheck, builds, migrations, UAT integrations, service startup and Playwright from a clean GitHub runner. The final Validation Report records the exact RC1 evidence.