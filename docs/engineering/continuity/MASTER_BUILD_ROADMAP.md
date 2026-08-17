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

### Gate 0 — Sprint 25 reconciliation

Current state: PR #29 is a green, unmerged Runtime correction candidate. Main remains on the pre-fix baseline.

Required sequence:

1. Architectural review of PR #29.
2. If approved, merge using the established repository strategy.
3. Validate the exact merged-main commit through all required workflows and complete regressions.
4. Update continuity records with the resulting immutable evidence.

### Gate 1 — Sprint 26

Sprint 26 is **not started** and remains blocked until Gate 0 is fully green and explicitly authorized.

Authorized scope after Gate 0 only:

- Production Multi-Unit & Fixed Restoration System
- fixed restoration case model and production workflow;
- bridge and multi-unit planning;
- unit-specific design, QC, persistence, export, and recovery;
- human QC and fail-closed behavior.

Do not add commercial platform work to Sprint 26 without a later architectural decision.

## Future commercial foundation

Exact sprint numbers are intentionally not assigned yet. Architectural sequencing will be decided after the current baseline is green.

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

GVM is an optional entitlement, not a required NorthStar Core feature. It will support component-level outsourcing, vendor capabilities and rates, logistics, vendor health, margin analysis, what-if simulation, hold/cancel workflows, tokenized work packages, communications, and immutable audit. See `GLOBAL_VENDOR_MANAGEMENT.md`.

## Roadmap discipline

- Existing certified history remains governed by the certification ledger.
- Planned commercial capabilities remain PLANNED or NOT_STARTED until repository evidence proves otherwise.
- No sprint is selected from this roadmap alone.
- Privacy, tenant isolation, human QC, immutable source lineage, fail-closed behavior, and no-secrets-in-GitHub are permanent gates.
