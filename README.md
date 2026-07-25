# CADence NorthStar

CADence NorthStar is the operating system for Keramos Dental Laboratory: case intake, doctor management, production routing, QC, shipping, billing, analytics, and future AI-assisted laboratory intelligence.

## Current milestone

**v0.1.0 — Foundation**

Included now:

- pnpm monorepo
- React + TypeScript web application
- Express + TypeScript API
- Shared domain package
- Initial laboratory dashboard
- Initial doctor and case data contracts
- API health and dashboard endpoints
- CI workflow for install, typecheck, and build

## Local setup

Requirements:

- Node.js 20+
- pnpm 9+

```bash
pnpm install
pnpm dev
```

Web application: `http://localhost:5173`

API: `http://localhost:4000`

Health check: `http://localhost:4000/health`

## Repository structure

```text
apps/
  web/      React front end
  api/      Express API
packages/
  shared/   Shared domain contracts

docs/      Architecture and roadmap
```

## Security

Do not commit patient data, passwords, API keys, access tokens, private health information, or production credentials.
