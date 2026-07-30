# NorthStar RC1 — Business Walkthrough Guide

## Recommended first UAT sequence

Use the personas in the Credential Manifest. Before the walkthrough, sign in as Tenant Owner, open **UAT Workspace**, and choose **Load deterministic scenarios**.

| Step | Persona | Starting page | Actions | Expected result | UAT focus | Known limitation |
|---:|---|---|---|---|---|---|
| 1 | Platform Owner simulation | Laboratory Status | Review system identity, ECC and UAT navigation | Platform-level simulation opens without tenant-data override | Authentication, routing, navigation | Commercial Platform Owner controls are Sprint 13B work |
| 2 | Tenant Owner | Laboratory Status | Review workload, notifications, quick actions and recent activity | Keramos tenant and role are clear; operational summary is populated | Landing experience | Advanced tenant customization is deferred |
| 3 | Customer Service | Digital Intake | Enter a realistic digital case and review required records | Case submission follows current intake validation and persists | Case intake | Full portal intake is deferred |
| 4 | Production Technician | Production Workflow | Open active production cases and review current departments | Seeded work appears across receiving, model, CAD, manufacturing, ceramics, QC and shipping | Production | Workflow Engine automation is deferred |
| 5 | CAD Designer | Production Workflow | Review cases assigned to CAD and related case information | CAD-scoped navigation and current production records are available | CAD role | Native CAD tooling is outside RC1 |
| 6 | QC Technician | Quality Control | Review seeded inspections, remakes and repairs; record a test QC result where supported | QC data persists and quality metrics update | QC | Predictive quality analytics is deferred |
| 7 | Shipping | Shipping & Logistics | Review ready, shipped and delivered cases | Seeded shipments and delivery state are visible | Shipping | External carrier integration is deferred |
| 8 | Accounting | Billing & Financial Engine | Review invoices, balances, payments and AR aging | Financial preview reflects seeded operational records | Billing | General Ledger and payment provider integration are deferred |
| 9 | Doctor | Case Intake | Review only the assigned Practice's patients and cases | Practice-scoped access succeeds; unrelated records remain unavailable | Doctor authorization | Full white-label portal remains deferred |
| 10 | Office Staff | Case Intake | Repeat the scoped case review and attempt prohibited administrative access | Delegated Practice access succeeds; administration is denied | Office-user authorization | Uses the current Doctor security mapping |
| 11 | Tenant Owner | Executive Command Center | Review production, quality, revenue, AR, communications and shipping summaries | KPI cards and previews use tenant-scoped seeded data and show freshness | ECC preview | No analytical warehouse or forecasting |
| 12 | Any tester | UAT Workspace | Execute a test case, record Pass/Fail/Blocked, report a defect and move it through the lifecycle | Test evidence, defect status, build and commit persist | UAT and defects | Screenshot evidence uses controlled UAT formats only |
| 13 | Sample Laboratory A Owner | Laboratory Status | Review dashboard, then attempt direct access to Keramos operational routes | Sample tenant shows isolated zero/sample metrics; Keramos access is denied without record disclosure | Tenant isolation | Tenant-native Sample Lab operational CRUD is deferred |

## Expected normal-day flow

```text
Customer Service
→ Receive case
→ Production review
→ CAD
→ QC
→ Shipping
→ Accounting
→ Doctor review
→ Executive dashboard
→ UAT defect submission
```

## Evidence to record

For each step:

1. Select the matching UAT test case.
2. Record the actual result.
3. Mark Pass, Fail or Blocked.
4. Add notes describing any difference from expected behavior.
5. Create a defect for every repeatable failure.
6. Attach a PNG, JPEG or WebP screenshot when useful.
7. Record workflow observations or enhancement ideas separately from defects.

## UAT decision rule

A critical or high defect that remains New, Triaged, In Progress or Ready for Retest blocks release readiness. Enhancement ideas do not block RC1 unless they reveal a missing required workflow.