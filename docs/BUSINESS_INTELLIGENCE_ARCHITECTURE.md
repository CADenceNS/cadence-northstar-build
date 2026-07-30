# Enterprise Business Intelligence Architecture

## Purpose

Define the analytical platform that supports the Executive Command Center, certified reporting, historical comparisons, forecasting, and future predictive analytics while preserving ERP source-domain ownership and tenant isolation.

## Architectural layers

```text
Operational Source Domains
  ↓ versioned extraction / outbox / CDC adapters
Analytical Staging
  ↓ validated transformations
Tenant-Isolated Warehouse
  ↓ semantic metrics layer
Executive Command Center / Reports / Authorized Exports
```

The warehouse is an analytical replica. It never becomes the authority for operational commands.

## Data ownership and tenancy

- every tenant fact and dimension contains an immutable tenant key;
- warehouse queries require tenant context before plan execution;
- row-level and workload isolation apply to interactive analytics, exports, caches, materialized views, and scheduled jobs;
- Platform aggregate analytics use separately approved de-identified datasets and cannot expose tenant records;
- support access requires the same explicit tenant grant used by operational systems.

## Core fact tables

Proposed facts include:

- `fact_case_intake`: submissions, cases, units, intake source, received time;
- `fact_production_transition`: department/state transitions, duration, assignment;
- `fact_quality_event`: inspection outcome, defect, remake, repair, rework and root cause;
- `fact_shipment`: ready, shipped, delivered, service level and on-time outcome;
- `fact_invoice_line`: product, quantity, gross/net amounts and tax reference;
- `fact_payment`: receipt, application, method and velocity;
- `fact_tax_determination`: jurisdiction, taxable base, collected tax and exemption decision;
- `fact_communication_event`: channel, direction, response duration, queue and related entity;
- `fact_workflow_sla`: target, elapsed, warning, breach and pause periods;
- `fact_subscription`: Platform commercial recurring revenue for Platform-authorized views;
- `fact_equipment_activity`: future machine availability and utilization telemetry.

## Core dimensions

- date, time and fiscal period;
- tenant laboratory and laboratory location;
- Practice, Doctor and customer account;
- patient surrogate identifier with minimum-necessary handling;
- restoration category/subtype and material;
- product, accounting category and department;
- technician, team and role;
- scanner/provider, production route and outsource partner;
- shipment method and carrier;
- communication channel and reason;
- quality defect and root-cause category;
- tax jurisdiction and exemption type;
- workflow template/state;
- release, build and environment.

Slowly changing dimensions preserve historical business meaning. Personally identifiable or clinical attributes are excluded unless explicitly required and approved.

## Time intelligence

The semantic layer supports:

- day, week, month, quarter and year;
- fiscal period and fiscal year;
- MoM, QoQ and YoY;
- rolling 7/30/90 days;
- rolling 12 months;
- same-business-day and same-fiscal-period comparisons;
- as-of reporting and certified closed-period snapshots.

Tenant-specific calendars, holidays, fiscal years and business-day rules are versioned.

## KPI semantic layer

A governed semantic layer maps approved KPI definitions to facts, dimensions, filters and calculation engines. It provides consistent naming, formula versioning, units, target thresholds, lineage, freshness and drill-down metadata. Dashboard authors cannot introduce unapproved financial or quality formulas through arbitrary SQL.

## Refresh and consistency

- operational near-real-time projections may update within minutes;
- daily certified snapshots are immutable after certification except through explicit restatement;
- accounting and tax reporting uses closed-period data and ledger/tax determination references;
- late-arriving events are reconciled by idempotent transformations;
- each dataset records source watermark, transformation version, load time, completeness and validation outcome.

## Reporting cubes and aggregates

Pre-aggregated cubes may serve common matrices such as restoration × material × period, quality × reason × department, customer × revenue × growth, AR × aging bucket, and throughput × department × technician. Cubes are replaceable performance optimizations, not independent facts.

## Forecasting and predictive extensions

Forecast providers consume approved analytical datasets through versioned contracts. Supported future targets include volume, capacity, SLA breach, quality risk, cash collection, attrition and tax liability. Predictions are stored separately from facts, expire according to policy, and retain model/version/evidence metadata.

## Data quality

Quality checks include source count reconciliation, referential integrity, duplicate detection, impossible durations, unbalanced financial totals, unknown dimensions, tenant leakage tests, freshness thresholds and KPI formula regression fixtures. Failed certified loads block publication and create assurance defects.

## Retention and privacy

Retention varies by legal, financial, tax, clinical and analytical purpose. Deletion or anonymization propagates through approved lineage-aware processes. Historical financial and tax facts remain according to statutory policy even when display identities are anonymized.

## Non-goals

No warehouse database, ETL/ELT tool, CDC pipeline, cube engine, forecasting model, or ECC query runtime is implemented in Sprint 13 architecture.