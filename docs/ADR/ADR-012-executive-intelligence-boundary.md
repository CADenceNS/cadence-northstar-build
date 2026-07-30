# ADR-012 — Executive Intelligence as an Analytical Boundary

## Status
Accepted for architecture; implementation deferred.

## Decision
The Executive Command Center and Business Intelligence platform will own KPI definitions, analytical snapshots, semantic metrics, dashboards, alerts, exports and explainable insights. Operational ERP domains remain authoritative and receive all drill-down and command requests through authorized domain services.

## Consequences
The warehouse and ECC cannot mutate operational state. Every KPI is versioned, tenant-scoped, lineage-aware and permission-bound. Predictive outputs remain separate from historical facts and are advisory unless a future ADR authorizes automation.