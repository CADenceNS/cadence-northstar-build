# CADence NorthStar Master Build Roadmap

## Purpose and authority

This is the program map, not an implementation authorization. `NEXT_ACTION.md` is the sole authority for what may be implemented now. A roadmap item is not evidence that the feature exists.

CADence is intended to become a standalone commercial product for independent dental laboratories. It must have its own public product identity and landing page and must not be branded as, owned by, or operationally tied to Keramos or another laboratory.

## Product architecture

CADence preserves three product pillars:

1. NorthStar ERP / Laboratory Operating Platform
2. Design Studio CAD/CAM
3. Knowledge Platform

A fourth layer sits above them:

4. CADence Commercial Platform — tenants, subscriptions, licensing, entitlements, seats, billing, branding, privacy, integrations, and platform administration.

The commercial layer governs access and commercial relationships; it does not replace tenant operational systems.

## Current and near-term order

### VIS-2C-F2 — Foundation Lock / Feature Coverage Reconciliation

Status: **OWNER APPROVED / CERTIFIED / MERGED** via PR #41; Product & Pricing implementation remains not started.

The owner-approved supplemental Product & Pricing / Case Configuration requirement is a
permanent additive NorthStar scope. Its complete, verbatim requirement text—including the
entire FIX, REM, IMP, ORT, SLP, DIA, SPL, and AUX catalog—is preserved in
docs/engineering/continuity/PRODUCT_PRICING_CASE_CONFIGURATION_REQUIREMENTS.md.
This requirement supplements, and does not replace, the approved CRM, laboratory
operations, commercial-platform, v4.2-derived NorthStar shell, or Design Studio scope.

The future platform must provide tenant-owned Product Catalog administration, explicit
compatibility/dependency validation, category-filtered product selection, dynamic
arch/tooth case configuration, multi-product case stacking, product-specific business-day
turnaround, authorized Rush handling, tenant closure calendars, effective-dated pricing
versions, historical price snapshots, customer/practice pricing, and authoritative
case-to-Production/QC/Shipping/Billing lineage. Product Catalog remains separate from
Pricing Schedules; neither may be represented as complete from a simple dropdown or
existing product-resolution record.

Current reconciliation classifications are recorded in
FEATURE_STATUS_MATRIX.md and REQUIREMENT_COMPLIANCE.md using only the supplemental
status vocabulary required for this eight-part review:
COMPLETE, PARTIAL, NOT STARTED, BLOCKED, CERTIFICATION REQUIRED.
No Product & Pricing implementation is authorized by this documentation task.

The approved v4.2-derived NorthStar workspace and current CADence Design Studio are locked
as additive-only foundations; foundational UI changes require explicit owner approval.
Merged-main CI #638, Runtime #403, and Sprint #297 passed with 51/51 Playwright in each
browser workflow. The next authorized action is PP-1A — Product Catalog, Pricing Foundation
& Case Product Line-Item Architecture (GPT-5.6 Terra), using the preserved requirement file.

### Gate 0 — Sprint 25 reconciliation

Status: **COMPLETE**.

PR #29 merged the Runtime export-status/autosave correction. Exact merged `main` passed CI, Runtime Validation, Sprint Validation, strict TypeScript, production builds, 421/421 deterministic tests, and 47/47 Playwright tests. The protected private-corpus evidence remains the PR #28 geometry evidence because PR #29 changed no certified CAD geometry paths.

### Gate 1 — Commercial architecture sequencing

Status: **REQUIRED BEFORE NEW PRODUCT IMPLEMENTATION**.

Before deeper NorthStar single-tenant assumptions are embedded, architecturally define and approve:

- tenant and organization isolation;
- identity, RBAC, support access, privacy, encryption, backups, recovery, and audit;
- subscriptions, billing, server-side entitlements, module switches, seat pools, and seat assignments;
- independent NorthStar, Design Studio, GVM, portal, Integration Hub, communications, KPI, branding, and future-module boundaries.

No implementation sprint number is assigned to this foundation yet.

### Gate 2 — Sprint 26

Sprint 26 is **not started** and remains blocked until Gate 1 is explicitly resolved and its sequencing decision authorizes implementation.

Previously planned scope:

- Production Multi-Unit & Fixed Restoration System;
- fixed restoration case model and production workflow;
- bridge and multi-unit planning;
- unit-specific design, QC, persistence, export, and recovery;
- human QC and fail-closed behavior.

Do not begin Sprint 26 in this task.

## Future commercial foundation

Exact sprint numbers are intentionally not assigned yet. Architectural sequencing will be decided before further single-tenant assumptions are added.

### Commercial foundation

- standalone CADence product identity and public landing page;
- tenant, organization, and laboratory account model;
- tenant-scoped identity, authorization, files, settings, and audit;
- encryption, backups, restore/recovery, and controlled break-glass support.

### Licensing and monetization

- CADence Owner/Super Admin dashboard;
- plans, subscriptions, trials, monthly/annual billing, renewals, failures, discounts;
- server-side entitlements and effective dates;
- independent module switches;
- seat pools and user-seat assignments;
- upgrades, downgrades, add-ons, and supported proration.

### Tenant products

- NorthStar Core;
- Design Studio with its own seat pool;
- tenant doctor/customer portal;
- tenant-specific branding and future custom domains;
- Integration Hub;
- Advanced Communications;
- Advanced KPI/Analytics.

### Optional commercial modules

- Global Vendor Management (GVM);
- White Label / Custom Branding;
- Doctor Portal where commercially configured;
- Future Automation/AI;
- Future Manufacturing/CAM;
- additional future modules.

### Operational architecture

- provider adapters and encrypted tenant credentials;
- communications command center;
- tenant KPI command center;
- separate CADence company KPI command center;
- audited support and licensing operations.

## GVM direction

GVM is an optional entitlement, not a required NorthStar Core feature. It will support component-level outsourcing, vendor capabilities and rates, logistics, vendor health, margin analysis, what-if simulation, hold/cancel workflows, tokenized work packages, communications, and immutable audit. See `docs/engineering/architecture/GLOBAL_VENDOR_MANAGEMENT.md`.

## Roadmap discipline

- Existing certified history remains governed by the certification ledger.
- Planned commercial capabilities remain PLANNED or NOT_STARTED until repository evidence proves otherwise.
- No sprint is selected from this roadmap alone.
- Privacy, tenant isolation, human QC, immutable source lineage, fail-closed behavior, and no-secrets-in-GitHub are permanent gates.
