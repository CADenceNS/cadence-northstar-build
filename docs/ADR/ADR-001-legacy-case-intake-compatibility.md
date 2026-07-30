# ADR-001 — Legacy Case Intake Compatibility

## Status

Accepted for Community Preview 2.

## Context

NorthStar has a verified direct Case Intake workflow used by existing ERP browser and API regressions. Sprint 12 introduces Digital Intake as the future standardized entry point. Removing or silently redirecting the established route during the foundation sprint would risk production behavior and weaken verified compatibility.

## Decision

The legacy Case Intake remains operational and unchanged during Sprint 12.

A future migration will replace its internal implementation with an application command that:

1. creates a Digital Intake submission using the `manual-digital` or `physical` intake method;
2. creates and completes the mandatory Digital Prescription from the legacy request;
3. runs validation, routing and Product Resolution;
4. creates the operational case only after the same acceptance rules pass;
5. returns a response compatible with the established Case Intake API.

The public compatibility contract may remain while the internal path converges on Digital Intake.

## Consequences

- Existing ERP workflows and regressions remain stable.
- Two entry implementations temporarily coexist.
- Digital Intake is not yet literally the only path in production.
- New features must target Digital Intake rather than expanding the legacy path.
- Removing the compatibility path requires a separate ADR, migration evidence, and full regression validation.

## Scanner provider boundary

Scanner providers remain adapters outside the transactional intake domain. Adapters translate provider-specific payloads into the common submission command. Scanner-specific credentials, webhooks and SDK behavior must not be embedded in prescription, routing, Product Resolution or Billing logic.
