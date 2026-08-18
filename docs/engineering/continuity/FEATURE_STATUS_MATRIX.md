# CADence Feature Status Matrix

Status values are restricted to: `CERTIFIED_PRODUCTION`, `IMPLEMENTED_PENDING_CERTIFICATION`, `IN_PROGRESS`, `BLOCKED`, `PLANNED`, `NOT_STARTED`, `UNSUPPORTED`, `RESEARCH_ONLY`.

This matrix describes repository evidence as of 2026-08-17. Commercial vision is not implementation evidence.

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
| CADence Commercial Platform layer | IN_PROGRESS | CF-1A0 authenticated tenant-context boundary certified; remaining CF-1 commercial capabilities are not implemented |
| Authenticated tenant-context propagation boundary | CERTIFIED_PRODUCTION | Draft PR #32 corrected product head `e60be1f`, tree `b4b3cddd`; CI/Runtime/Sprint green, deterministic PASS, Playwright 47/47; pending architectural merge only |
| True tenant isolation | IN_PROGRESS | CF-1A0 prevents fixed/default authenticated runtime scope; complete operational-entity isolation remains CF-1A work |
| Tenant-scoped staff, patients, cases, production, QC, shipping, billing, files, settings | PLANNED | Commercial multi-tenant capability not implemented |
| Tenant-scoped backups, restore, encryption, break-glass support | PLANNED | Design requirement only |
| CADence Owner/Super Admin licensing dashboard | PLANNED | No commercial administration evidence |
| Subscriptions, trials, billing, renewals, discounts, proration | PLANNED | No commercial billing evidence |
| Server-side entitlements and independent module switches | PLANNED | No entitlement-service evidence |
| Separate NorthStar and Design Studio seat pools | PLANNED | No seat-pool evidence |
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
