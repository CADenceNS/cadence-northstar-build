# CADence Feature Status Matrix

Status values are restricted to: `CERTIFIED_PRODUCTION`, `IMPLEMENTED_PENDING_CERTIFICATION`, `IN_PROGRESS`, `BLOCKED`, `PLANNED`, `NOT_STARTED`, `UNSUPPORTED`, `RESEARCH_ONLY`.

This matrix describes repository evidence as of 2026-08-19. Commercial vision is not implementation evidence.

CF-1A2 — Module Entitlements + Seat Pools: **CERTIFIED_AND_MERGED**. CF-1A3A — Activation Licensing + Platform Admin Commercial Controls: **CERTIFIED_AND_MERGED** via PR #36; product head `53b4773aaa9cfe807f12ff77c9da215eb39d6074`, tree `778d358c653200a5276434e00da59e41e6bfad48`, merge `55e34f983bf18cc8cd35660ed0b318e953b782d4`; merged-main CI/Runtime/Sprint #613/#378/#272 passed; deterministic 421/421 and Playwright 49/49.

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
| CADence Commercial Platform layer | CERTIFIED_PRODUCTION | CF-1A0/CF-1A1 tenant boundaries, CF-1A2 entitlements/seats, and CF-1A3A activation/licensing plus commercial control-plane services are certified and merged; management UI and billing remain separate work |
| Authenticated tenant-context propagation boundary | CERTIFIED_PRODUCTION | PR #32 merged as `1136a838`; certified product head `e60be1f`, tree `b4b3cddd`; post-merge CI/Runtime/Sprint green, deterministic PASS, Playwright 47/47 |
| True tenant isolation | CERTIFIED_PRODUCTION | CF-1A1 product head `fd8d0f5` / tree `7d4215f0` adds lifecycle/membership-aware trusted-context tenant-native repository access and cross-tenant read/write/delete/list/search/browser proofs; CI, Runtime, Sprint, deterministic, and Playwright gates are green |
| Tenant-scoped staff, patients, cases, production, QC, shipping, billing, files, settings | CERTIFIED_PRODUCTION | Tenant-scoped operational repository and artifact metadata paths are certified by CF-1A1; commercial entitlements/seats remain later CF-1A work |
| Activation credentials and lifecycle controls | CERTIFIED_PRODUCTION | CF-1A3A exact-head DB/security and merged-main workflow evidence: issue/verify/replay, revoke/rotation, raw-secret protection, suspension/reactivation, and cancellation/data preservation |\n| Platform Admin commercial control-plane services and operational boundary | CERTIFIED_PRODUCTION | CF-1A3A exact-head DB/security and merged-main workflow evidence; no Platform Admin management UI claim |\n| Tenant-scoped backups, restore, encryption, break-glass support | PLANNED | Design requirement only |
| CADence Owner/Super Admin licensing dashboard | PLANNED | No commercial administration evidence |
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
