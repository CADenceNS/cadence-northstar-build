# CADence Commercial Platform Architecture

Status: PLANNED / NOT_STARTED. This document defines architecture intent only.

## Product boundary

CADence Commercial Platform is the commercial control plane above:

1. NorthStar ERP / Laboratory Operating Platform
2. Design Studio CAD/CAM
3. Knowledge Platform

It provides commercial identity, organizations, subscriptions, entitlements, seats, billing, branding, integrations, privacy controls, and platform administration. It must be independently sellable to laboratories and must not expose Keramos-specific identity or data.

## Tenant model

Every subscribing laboratory is an isolated organization/tenant.

Tenant-owned domains include:

- users, roles, practices, doctors, patients, cases, production, QC, shipping;
- AR/AP, invoices, communications, reports, files, settings, integrations;
- GVM configuration and Design Studio data where licensed.

Every request must resolve an organization context and enforce it at the service, repository, storage, search, event, export, and reporting boundaries. Tenant IDs are mandatory in ownership keys and audit records. Tenant A must never read, search, export, infer, or receive Tenant B data.

## Control plane and data plane

The commercial control plane may manage:

- organization lifecycle;
- subscription and plan state;
- module entitlements;
- seat pools and assignments;
- billing status;
- licensing audit;
- platform health and aggregate commercial metrics.

The control plane must not provide ordinary unrestricted browsing of tenant patients, doctors, cases, designs, vendor pricing, or internal finances. Operational content remains in tenant-scoped data-plane services.

## Entitlements and seats

Planned relationship:

`Tenant → Subscription → Plan → Entitlements → Seat Pools → User Seat Assignments → RBAC Permissions`

Each entitlement has a module, state, effective dates, limits, trial/paid origin, and audit history. Plans are collections of entitlements, not hard-coded product variants.

Design Studio has an independent seat pool. Example: NorthStar 25 seats and Design Studio 4 seats. Turning a module off blocks UI, direct URL, API, and service execution while preserving historical data according to retention policy. Re-enabling restores authorized access.

## Platform administration

A CADence Owner/Super Admin dashboard is planned for:

- laboratory provisioning, activation, suspension, cancellation, and reactivation;
- monthly/annual subscriptions, trials, renewals, failed payments, discounts, promotions;
- licensed seats, usage, module trials, effective dates, upgrades, downgrades, add-ons;
- immutable licensing history and aggregate company KPIs.

Activation keys may assist onboarding but cannot be the sole authorization mechanism. Server-side organization entitlement is authoritative.

## Security, privacy, and recovery

Planned controls include encryption in transit and at rest, tenant-scoped backups, tested restore/recovery, immutable access audit, least privilege, and explicit break-glass support access with:

- named authorization;
- reason and scope;
- tenant consent/policy where required;
- automatic expiration;
- complete immutable audit;
- no ordinary support browsing by default.

No architecture statement here is a HIPAA certification or legal conclusion.

## Tenant products

Each tenant may later enable:

- NorthStar Core;
- Design Studio;
- GVM;
- Integration Hub;
- Advanced Communications;
- Advanced KPI/Analytics;
- White Label / Custom Branding;
- Doctor Portal;
- future Automation/AI and Manufacturing/CAM modules.

The tenant doctor/customer portal is planned to support case submission, digital Rx, scan/file upload, case tracking, communication, shipments, invoices, statements, payments, history, preferences, and authorized office users.

## Integrations and branding

Integration Hub adapters are planned for scanners, scanner portals, digital intake, accounting/billing, payments, phone/VoIP, SMS, email, CRM, marketing, shipping, cloud storage, intraoral scanner networks, and manufacturing/CAM services.

Each tenant owns its connected credentials. Use OAuth when available, scoped credentials otherwise, encrypted secret storage, connection testing, sync/error status, reconnect flows, webhooks, and explicit permission scopes.

Tenant branding includes laboratory name, logo, colors, contact information, invoices, statements, email, notifications, reports, portal, and future custom domains. Doctors should experience their laboratory's brand.

## Company-level analytics

CADence platform analytics must be separate from tenant operational analytics. Aggregate commercial metrics may include clients, trials, churn, MRR/ARR, seats, module adoption, failed payments, renewals, upgrades, downgrades, retention, and support burden. Underlying tenant operational content must not be exposed merely to compute platform KPIs.

## Architecture gates

Before implementation, architecture must define tenant-boundary tests, authorization denial behavior, storage isolation, backup/restore scope, support access lifecycle, entitlement enforcement at UI/API/service layers, seat concurrency, billing events, audit retention, and incident response. Planned capability is not product evidence.
