# CADence NorthStar

CADence NorthStar is the laboratory operating system for Keramos Dental Laboratory.

## Current milestone

**v0.3.0 — Workflow Control & Data Safety**

This milestone adds editable Practice and Doctor CRM records, case editing and deletion, guarded relationship deletion, case-status progression, production workload controls, search and filtering, overdue case identification, and JSON backup/import recovery.

## Development login

- Email: `dorianhabet@yahoo.com`
- Password: `NorthStar!2026`

These are development-only credentials and must be replaced before production deployment.

## Local setup

Requirements: Node.js 20+ and pnpm 9+

```bash
pnpm install
pnpm dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`

## Data persistence

v0.3.0 continues to use browser localStorage and now includes Settings → Export backup / Import backup. PostgreSQL-backed persistence remains a future production milestone.

## Security

Never commit patient names, protected health information, passwords, access tokens, API keys, or production credentials.
