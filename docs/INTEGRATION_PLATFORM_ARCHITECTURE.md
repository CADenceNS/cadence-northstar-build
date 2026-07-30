# Integration Platform Architecture

## Purpose

Define a provider-neutral, tenant-isolated integration platform for NorthStar covering REST APIs, webhooks, imports, exports, accounting, shipping, payments, tax, scanner SDKs, AI services, notifications and identity providers.

## Principles

- domains expose stable application ports rather than provider-specific logic;
- external providers are adapters, never sources of NorthStar identity;
- every command is authenticated, authorized, tenant-scoped and idempotent;
- outbound events use versioned schemas and delivery records;
- secrets remain in managed secret storage, not tenant configuration documents;
- integration failures are observable, retryable and auditable;
- no integration bypasses domain validation or writes domain tables directly.

## Domain model

- `integration_definition`: stable integration type and supported capabilities;
- `tenant_integration`: tenant/provider configuration, state and effective period;
- `integration_credential_reference`: secret-manager reference and rotation metadata;
- `integration_endpoint`: base URL, region, environment and allowlist metadata;
- `integration_subscription`: event types, filters and destination;
- `webhook_delivery`: event, attempt, response, signature version and outcome;
- `import_job`: source object, schema, validation, rows and disposition;
- `export_job`: dataset, authorization, format, object reference and expiry;
- `integration_mapping`: versioned external-to-internal code mapping;
- `integration_cursor`: provider watermark or sync token;
- `integration_incident`: degraded state, impact and resolution;
- `integration_audit_event`: configuration and credential lifecycle history.

## API architecture

REST APIs use versioned resource and command contracts, OAuth/OIDC or signed service credentials, tenant context, least-privilege scopes, request IDs, idempotency keys, rate limits, pagination and safe error responses. External APIs never expose internal ObjectStorage keys or unrestricted database identifiers.

## Webhooks

Outbound webhooks are produced from a transactional outbox. Deliveries are signed, timestamped, replay-protected and retried with bounded exponential backoff. Consumers acknowledge stable event IDs. Dead-letter deliveries enter an operational review queue.

Inbound webhooks require provider identification, signature verification, timestamp tolerance, replay detection, schema validation, tenant binding and idempotency before invoking an application command.

## Import and export

Imports are asynchronous and staged. They include schema/version identification, malware scanning for files, row validation, preview, authorization, error reports and explicit commit. Partial acceptance policy is declared per import type.

Exports are asynchronous, authorized at request and download time, tenant-scoped, audited, retained for a limited period and delivered through secure ObjectStorage URLs or approved transfer adapters.

## Provider families

### Accounting

Supports future general-ledger export, journal synchronization, customer/vendor mapping, payment reconciliation and period-status checks. NorthStar Accounting remains authoritative for internal books unless an approved deployment chooses an external accounting system as the accounting authority.

### Shipping

Supports rates, labels, tracking, pickup scheduling and delivery events through carrier adapters. Shipping domain retains shipment state authority.

### Payments

Supports tokenized payment methods, authorization, capture, refund, settlement and webhook reconciliation. Raw payment-card data does not enter NorthStar scope.

### Tax

Uses the TaxProvider port defined by Tax architecture. Provider results translate into immutable NorthStar determinations.

### Scanner SDKs

Remain adapters outside Digital Intake. Scanner submissions create standardized intake commands and ObjectStorage records.

### AI services

Receive minimum-necessary, policy-approved data. Every result includes provider/model/version, evidence, confidence and retention. AI services cannot independently authorize workflow or financial changes.

### Notification providers

Email, SMS, push and CTI adapters consume approved notification/communication commands. Communications remains the operational-history source.

### Identity providers

OIDC, SAML and SCIM adapters map external identities to NorthStar memberships and permissions. Provider groups do not bypass NorthStar authorization.

## Environment and tenancy

Credentials, endpoints, callbacks and domain verification are environment-bound. Production credentials cannot be reused in Development or UAT. Tenant integration jobs run with quotas and fair scheduling to prevent noisy-neighbor impact.

## Observability

Track request rate, success/failure, latency, retries, rate-limit state, credential expiry, cursor lag, queue depth and dead letters. Operational telemetry excludes secrets and unnecessary clinical payloads.

## Versioning and compatibility

Contracts use explicit versions and deprecation windows. Breaking changes require a new version, migration guidance, compatibility tests and ADR when the long-term boundary changes.

## Non-goals

No provider adapter, external API, webhook endpoint, import/export runtime, credential store or integration UI is implemented in this architecture sprint.