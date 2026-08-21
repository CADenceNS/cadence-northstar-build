# CADence Feature Status Matrix

Status values are restricted to: `CERTIFIED_PRODUCTION`, `IMPLEMENTED_PENDING_CERTIFICATION`, `IN_PROGRESS`, `BLOCKED`, `PLANNED`, `NOT_STARTED`, `UNSUPPORTED`, `RESEARCH_ONLY`.

This matrix describes repository evidence as of 2026-08-21. Commercial vision is not implementation evidence.

## VIS-2C-F2 supplemental Product & Pricing / Case Configuration reconciliation

The complete owner-approved requirement is preserved verbatim in
PRODUCT_PRICING_CASE_CONFIGURATION_REQUIREMENTS.md. It is additive to all existing
NorthStar CRM, laboratory operations, commercial-platform, v4.2-derived shell, and Design
Studio requirements. The statuses below use the required supplemental vocabulary only:
COMPLETE, PARTIAL, NOT STARTED, BLOCKED, CERTIFICATION REQUIRED.

| Supplemental capability | Status | Current repository evidence / boundary |
|---|---|---|
| PRODUCT_CATALOG | PARTIAL | product-catalog-foundation.ts, product_catalog, tenant-scoped create and auto-resolution exist; full owner catalog, edit/deactivate/archive administration, complete category rules, and all supplied catalog records are not implemented/certified. |
| PRICING_ENGINE | NOT STARTED | Pricing schedules can be administratively created/updated, but no complete server-backed price calculation, pricing basis, discounts, tax/fee, Rush pricing, or authoritative case total exists. |
| MULTI_PRODUCT_CASE_STACKING | PARTIAL | Digital prescriptions and intake_product_resolutions can carry multiple restoration entries; the required independent line-item stacking, compatibility/dependency rules, totals, and committed snapshots are not complete. |
| CATEGORY_FILTERING | NOT STARTED | Active catalog reads and product resolution exist, but category-filtered selection plus server-side rejection of incompatible category/product combinations is not implemented as required. |
| ARCH_TOOTH_CONFIGURATION | PARTIAL | Existing prescription payloads carry arches and tooth numbers; dynamic category/product-specific NONE/SINGLE/MULTIPLE/PARTIAL/FULL/UPPER/LOWER/BOTH configuration and server validation are not complete. |
| BUSINESS_DAY_TAT_ENGINE | PARTIAL | Existing durable helper logic distinguishes basic 10/14-day patterns and excludes weekends; tenant holidays/closure days, multi-product deterministic maxima, immutable manual overrides, and product-specific rules are not complete. |
| PRICE_VERSIONING | NOT STARTED | No complete effective-dated/versioned price book, historical price snapshot, or customer/practice-specific price lineage is present. |
| CASE_TO_BILLING_PRODUCT_LINEAGE | PARTIAL | Product resolution and Billing Review history exist, but authoritative case product line items with independent prices, allocations, snapshots, and downstream Production/QC/Shipping/Billing/analytics lineage are not complete. |

These classifications are not claims of completion and do not authorize Product & Pricing
implementation. The complete initial catalog is retained in the linked requirement record.

CF-1A2 — Module Entitlements + Seat Pools: **CERTIFIED_AND_MERGED**. CF-1A3A — Activation Licensing + Platform Admin Commercial Controls: **CERTIFIED_AND_MERGED** via PR #36. CF-1A3B — Platform Admin Commercial Management UI: **CERTIFIED AND MERGED** via PR #37; product head `0535e8c433226c167cca85ffefd83d50ee1d57db`, tree `2b72dce8956e940d93e6513567d19039c1609e8c`, main merge `e03f85144f31533e8785588c5cf1514a92184ab1`; merged-main CI/Runtime/Sprint #622/#387/#281 passed; Runtime/Sprint Playwright 51/51. VIS-1B — Production Preview Runtime Readiness: **CERTIFIED AND MERGED** via PR #38; merge `d2f4d3e01cfd25ec95104f8e71f7795a8e9de889`, tree `616a00d409cf98ff64255c8545efbcfc13a4d143`; CI/Runtime/Sprint #625/#390/#284 passed; Runtime/Sprint Playwright 51/51. No deployment occurred.

| Capability | Status | Evidence / boundary |
|---|---|---|
| Scan registration, bite evidence, dental coordinates, fallback, persistence/recovery | CERTIFIED_PRODUCTION | Sprint 22/22A exact merged evidence |
| Versioned geometry editing, intersection classification, closed-curve trim, history/recovery | CERTIFIED_PRODUCTION | Sprint 23/23A exact merged evidence |
| Preparation identification, segmentation, margin analysis/editing, lineage, multi-preparation workflows | CERTIFIED_PRODUCTION | Sprint 24 exact merged evidence; real scans support robustness, not unproven clinical accuracy |
| Single-unit tooth-supported crown system | CERTIFIED_PRODUCTION | PR #28 public/private geometry evidence plus PR #29 merged exact-main correction; no certified CAD geometry path changed in PR #29 |
| Sprint 25 Runtime export completion observation | CERTIFIED_PRODUCTION | PR #29 merged; CI, Runtime, Sprint, 421 deterministic, 47 Playwright all green |
| Fully reconciled Sprint 25 on main | CERTIFIED_PRODUCTION | Main `5cc2b4ab` / tree `f764f862`; all merged-main gates green |
| Multi-unit and fixed restoration production system | NOT_STARTED | Previously planned Sprint 26 scope; requires Gate 1 commercial architecture sequencing |
| Three-product CADence structure | IN_PROGRESS | Existing NorthStar, Design Studio, and Knowledge Platform direction is established; commercial boundary is planned |
| CADence Commercial Platform layer | CERTIFIED_PRODUCTION | CF-1A0/CF-1A1 tenant boundaries, CF-1A2 entitlements/seats, CF-1A3A activation/licensing/control-plane services, and CF-1A3B Platform Admin commercial management UI are certified; subscription billing remains separate work |
| Authenticated tenant-context propagation boundary | CERTIFIED_PRODUCTION | PR #32 merged as `1136a838`; certified product head `e60be1f`, tree `b4b3cddd`; post-merge CI/Runtime/Sprint green, deterministic PASS, Playwright 47/47 |
| True tenant isolation | CERTIFIED_PRODUCTION | CF-1A1 product head `fd8d0f5` / tree `7d4215f0` adds lifecycle/membership-aware trusted-context tenant-native repository access and cross-tenant read/write/delete/list/search/browser proofs; CI, Runtime, Sprint, deterministic, and Playwright gates are green |
| Tenant-scoped staff, patients, cases, production, QC, shipping, billing, files, settings | CERTIFIED_PRODUCTION | Tenant-scoped operational repository and artifact metadata paths are certified by CF-1A1; commercial entitlements/seats remain later CF-1A work |
| Activation credentials and lifecycle controls | CERTIFIED_PRODUCTION | CF-1A3A exact-head DB/security and merged-main workflow evidence: issue/verify/replay, revoke/rotation, raw-secret protection, suspension/reactivation, and cancellation/data preservation |\n| Platform Admin commercial control-plane services and operational boundary | CERTIFIED_PRODUCTION | CF-1A3A exact-head DB/security and merged-main workflow evidence; no Platform Admin management UI claim |\n| Tenant-scoped backups, restore, encryption, break-glass support | PLANNED | Design requirement only |
| CADence Owner/Super Admin licensing dashboard | CERTIFIED_PRODUCTION | CF-1A3B Platform Admin commercial management UI is certified and merged via PR #37 |
| Owner preview CADence NorthStar shell identity | CERTIFIED_PREREQUISITE | VIS-1D PR #39 merged; active browser shell no longer presents Keramos/UAT/Sprint product identity; owner visual acceptance remains pending |
| Subscriptions, trials, billing, renewals, discounts, proration | PLANNED | No commercial billing evidence |
| Server-side entitlements and independent module switches | CERTIFIED_PRODUCTION | CF-1A2/CF-1A3A entitlement and commercial activation regression evidence; NORTHSTAR_CORE and DESIGN_STUDIO registered with server-side enforcement |
| Separate NorthStar and Design Studio seat pools | CERTIFIED_PRODUCTION | CF-1A2 entitlement/seat regression evidence with independent NorthStar and Design Studio pools |
| Tenant doctor/customer portal | PLANNED | No tenant portal evidence |
| White-label branding and custom domains | PLANNED | No commercial branding evidence |
| Integration Hub | PLANNED | No tenant-isolated provider adapter evidence |
| Communications Command Center | PLANNED | No omnichannel communication implementation evidence |
| Tenant KPI Command Center | PLANNED | No tenant analytics evidence |
| CADence Company KPI Command Center | PLANNED | No platform-commercial analytics evidence |
| GVM optional module | PLANNED | No GVM implementation evidence |
| GVM component-level routing | PLANNED | Architecture requirement only |
| GVM vendor analytics, logistics board, health, margin, what-if | PLANNED | Architecture requirement only |
| GVM tokenized work packages and disclosure controls | PLANNED | Architecture requirement only; no HIPAA claim |
| GVM cancellation/hold/communications/audit | PLANNED | Architecture requirement only |
| Automatic clinical preparation or margin accuracy from unlabeled scans | UNSUPPORTED | Ground truth is required for clinical accuracy claims |
| Automatic manufacturing approval without human QC | UNSUPPORTED | Human QC and fail-closed rules are mandatory |
| Exact PR #29 private-corpus rerun | UNSUPPORTED | Not rerun because certified CAD geometry paths did not change; prior PR #28 evidence remains separately recorded |
| Future Automation/AI and Manufacturing/CAM modules | RESEARCH_ONLY | Future direction only; no implementation claim |
