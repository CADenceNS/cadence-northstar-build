# Executive Command Center Architecture

## Purpose

The Executive Command Center (ECC) is NorthStar's tenant-isolated executive intelligence experience for laboratory owners, executives, Tenant Owners, and explicitly authorized management roles. It converts trusted operational and financial data into explainable KPIs, trends, alerts, and drill-down paths without becoming a source-of-truth ERP domain.

## Executive questions

The ECC must answer:

- How is the laboratory performing today?
- Where are quality issues occurring?
- Which customers are growing or declining?
- What financial and tax obligations exist?
- Which operational bottlenecks require attention?
- Are turnaround and service-level commitments being met?
- Which trends are emerging over time?

## Boundary

The ECC owns KPI definitions, dashboard layouts, benchmark targets, alert policies, analytical snapshots, saved views, report exports, and explainable insight records. It does not own cases, prescriptions, production transitions, QC inspections, communications, invoices, tax determinations, payments, accounting journals, users, or files.

Source domains remain authoritative. Drill-down requests return authorized operational records through domain-owned query services.

## Access model

Every ECC request evaluates:

1. tenant identity;
2. laboratory location and Practice scope where relevant;
3. executive/management permission;
4. KPI sensitivity classification;
5. source-domain entity authorization;
6. commercial entitlement and feature flag;
7. export permission when applicable.

Platform Owner receives aggregate platform-health analytics only by default. Tenant business intelligence requires an explicit, expiring, audited support grant.

## Dashboard hierarchy

### Executive Overview

- production received/completed;
- incoming versus outgoing volume;
- revenue and gross production value;
- AR and aging exposure;
- global remake/repair rates;
- on-time delivery and average turnaround;
- backlog and queue aging;
- customer growth/decline;
- communication service levels;
- tax liability summary;
- current alerts and exceptions.

### Production Intelligence

- cases and units received/completed;
- throughput by period;
- incoming versus outgoing;
- restoration-by-material volume matrix;
- department, technician, location, scanner, route, and outsource breakdowns;
- MoM, QoQ, YoY, rolling-period comparisons.

### Quality Intelligence

- remake, repair, rework, hold, clarification, and first-pass-yield metrics;
- target gauges and historical trends;
- breakdowns by restoration, material, Doctor, technician, department, scanner, location, reason, and root cause;
- Pareto views and failure heat maps;
- forecasting extension points.

### Communications Intelligence

- incoming/outgoing/accepted/missed/abandoned calls;
- average wait and handle time;
- unread messages and queue depth;
- first-response and resolution time;
- Doctor, case, customer, channel, and department volume;
- future CTI provider comparisons.

### Financial Intelligence

- gross production value, revenue, invoice value, average case value;
- outstanding checkout value;
- AR and 30/60/90/120+ aging;
- collections and payment velocity;
- gross and net margin when accounting data is available;
- tax liability, sales tax, use tax, and state breakdowns;
- subscription/platform revenue for authorized Platform control-plane users;
- MoM, QoQ, YoY, rolling 12 months, fiscal-year views.

### Customer Intelligence

- top customers by revenue, volume, growth, and margin;
- retention, dormant and lost accounts;
- customer lifetime value;
- average revenue/units per Doctor;
- case, material, and Practice mix;
- revenue concentration;
- selectable Top 10/15/20/30/40/50.

### Operational Intelligence

- on-time delivery;
- average turnaround;
- global and department backlog;
- queue aging and cases waiting;
- rush volume;
- capacity utilization;
- department throughput;
- technician productivity;
- equipment utilization when telemetry is available.

## KPI definition model

Each `kpi_definition` records:

- stable code and version;
- business definition;
- formula expression or calculator reference;
- unit and formatting;
- source datasets and source fields;
- dimensional grain;
- supported filters;
- refresh cadence;
- historical retention;
- target, warning, and critical thresholds;
- drill-down contract;
- sensitivity class;
- owner and approval status;
- effective period and superseded version.

Related concepts:

- `kpi_snapshot`: immutable value by tenant, time, grain, dimensions, and definition version;
- `kpi_realtime_value`: short-lived calculation/cache with as-of timestamp;
- `kpi_target`: tenant/location/department target with effective period;
- `kpi_alert_policy`: comparator, threshold, duration, suppression, recipient policy;
- `dashboard_layout`: owner, audience, widgets, filters, effective version;
- `executive_insight`: explainable rule/analytical output with evidence and confidence.

## Calculation architecture

- real-time calculators serve low-latency operational KPIs from authorized read models;
- scheduled jobs produce stable hourly/daily/monthly snapshots;
- warehouse transformations calculate historical and cross-domain metrics;
- every displayed value includes definition version, as-of time, freshness state, and source lineage;
- late-arriving corrections create restated snapshots rather than silently overwriting certified periods;
- prediction services are adapters and may never replace historical facts.

## Visual design contract

Supported visual specifications include KPI cards, gauges, trend lines, comparison bars, waterfall charts, Pareto charts, heat maps, cohort tables, volume matrices, geographic maps when jurisdiction data is available, and drill-down tables. Visual definitions are declarative, sanitized, versioned, accessible, exportable, and constrained to approved chart types.

## Drill-down

Every KPI declares a drill-down contract identifying the source domain, dimensions, filters, and required permissions. Aggregates must not reveal a restricted individual through small-group inference. Exports are tenant-scoped, watermarked where appropriate, recorded in immutable audit, and generated through authorized report services.

## Predictive and AI extension points

Future models may forecast demand, remake risk, cash collection, capacity, SLA breach, customer attrition, or equipment utilization. Each insight identifies model/version, training-data boundary, evidence window, confidence, explanation, limitations, and human action. AI remains advisory unless a separately approved policy and ADR authorize automation.

## Non-goals

No dashboard UI, warehouse pipeline, KPI runtime, prediction model, CTI integration, accounting implementation, or report generator is implemented by this architecture document.