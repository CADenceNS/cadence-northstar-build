# Architecture

CADence NorthStar begins as a modular monorepo and will evolve toward a service-oriented enterprise platform only when operational scale justifies the added complexity.

## Initial layers

1. **Presentation** — React web application
2. **API** — Express HTTP service
3. **Domain contracts** — shared TypeScript models
4. **Persistence** — planned PostgreSQL + Prisma layer
5. **Workflow** — planned laboratory routing engine
6. **Events** — planned audit and automation events
7. **Intelligence** — planned analytics and AI assistance

## Operational routes

- Route A — Pure digital: Receiving → CAD → Mill/Print → Ceramics → QC
- Route B — Hybrid: Receiving → Model → Digitization/CAD → Mill/Print → Ceramics → QC
- Route C — Manual: Receiving → Model → Ceramics → QC

Shipping and invoice creation follow successful QC completion.
