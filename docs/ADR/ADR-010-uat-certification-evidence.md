# ADR-010 — UAT Evidence Is a Release Assurance Domain

## Status
Accepted for architecture; implementation deferred.

## Decision
UAT plans, cases, executions, defects, approvals, and certification evidence form a Release Assurance domain. They are not production workflow state, Clinical Communications history, or security audit. UAT records reference builds, commits, modules, and environments and retain append-only execution and defect histories.

## Consequences
Release approval requires current-head engineering evidence plus authorized UAT approvals. Critical and High defects block certification. UAT attachments use ObjectStorage. UAT data must be synthetic or de-identified and is governed separately from clinical retention.