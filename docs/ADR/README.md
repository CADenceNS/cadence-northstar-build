# Architecture Decision Records

ADRs are the permanent architectural history of CADence NorthStar.

## Mandatory use

A new ADR is required whenever a change introduces or materially changes a domain boundary, ownership model, service, provider, queue, public contract, persistence strategy, security/tenant model, cross-domain transaction, compatibility strategy or significant infrastructure decision.

Routine implementation details that do not affect long-term architecture do not require an ADR.

## Lifecycle

1. Use the next sequential `ADR-NNN-descriptive-name.md` number.
2. Record context, decision, consequences and rejected alternatives.
3. Use status `Proposed`, `Accepted`, `Deprecated` or `Superseded`.
4. Never delete an accepted ADR; replacements mark prior records superseded.
5. Reference relevant ADRs in sprint and PR architecture sections.
6. Validate ADR changes on the same final commit as the work they govern.

## Current records

- ADR-001 — Legacy Case Intake compatibility strategy
- ADR-002 — Product Catalog and Pricing Schedule separation
- ADR-003 — Scanner Provider adapter architecture
- ADR-004 — Event-driven Billing Review handoff
- ADR-005 — Communications as the operational-history domain
- ADR-006 — Tax determination boundary
- ADR-007 — Platform commercial control plane
- ADR-008 — White-Label Laboratory Platform tenant-experience boundary
- ADR-009 — Environment-isolated demo reset
- ADR-010 — UAT certification evidence boundary
- ADR-011 — Workflow orchestration boundary

Future decisions may include managed cloud ObjectStorage, CAD compute orchestration, AI clinical governance, tax-provider selection, payment-provider selection, custom-domain provider and identity-provider integration.