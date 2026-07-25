# CADence NorthStar

CADence NorthStar is the laboratory operating system for Keramos Dental Laboratory.

## Current milestone

**v0.2.0 — Core Platform**

This milestone adds a working administrator login, persistent browser storage, Practice CRM, Doctor CRM, case intake, automatic account and case numbering, laboratory dashboard metrics, user-role foundation, and audit history.

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

v0.2.0 stores application records in browser localStorage so the milestone can be used immediately without database setup. PostgreSQL-backed persistence and production authentication are scheduled for the next security/data milestone.

## Security

Never commit patient names, protected health information, passwords, access tokens, API keys, or production credentials.
