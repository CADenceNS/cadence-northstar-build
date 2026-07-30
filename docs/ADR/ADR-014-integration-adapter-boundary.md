# ADR-014 — External Integrations Behind Stable Adapters

## Status
Accepted for architecture; implementation deferred.

## Decision
REST clients, webhooks, imports, exports and external providers will integrate through stable, versioned application ports and provider adapters. Providers may not write domain tables or replace NorthStar tenant identity, authorization or domain validation.

## Consequences
Inbound requests require tenant binding, authentication, signature/replay checks and idempotency. Outbound delivery uses transactional outbox, signed webhooks, retries and dead-letter review. Provider identifiers remain mapping data rather than primary NorthStar identity.