# ADR-003 — Keep Scanner Providers Outside the Transactional Intake Domain

- **Status:** Accepted
- **Date:** 2026-07-28
- **Decision owners:** NorthStar Architecture and Digital Intake domains

## Context

NorthStar must accept submissions from many scanner manufacturers, portals, file transfers, manual uploads, and future SDKs. Vendor-specific credentials, payload formats, retries, and webhook behavior change independently from the laboratory intake lifecycle.

## Decision

Scanner Providers are external adapters. Each provider translates its vendor contract into the stable NorthStar submission contract and then invokes Digital Intake.

The provider abstraction distinguishes:

- official vendor adapters;
- generic file providers;
- manual upload providers;
- simulators used for contract and browser validation;
- future provider SDK implementations.

Provider records explicitly declare whether an adapter is production ready. Scanner-specific business rules must not be embedded in prescription validation, routing, Product Resolution, Billing, Communications, or workflow modules.

## Consequences

- New manufacturers can be added without redesigning Digital Intake.
- Vendor failures and credentials remain isolated from the transactional ERP boundary.
- Provider simulators cannot be represented as verified production integrations.
- Routing decisions remain independent from scanner source.
- Future webhooks and queues may be added at the adapter boundary.

## Alternatives rejected

- Add scanner-specific columns and branches throughout intake: rejected because it creates permanent vendor coupling.
- Make each scanner a separate intake workflow: rejected because every case must converge into one standardized lifecycle.
