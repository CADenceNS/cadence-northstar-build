# Demo, Test Data & UAT Architecture

## Purpose

Define deterministic demonstration environments and a permanent User Acceptance Testing framework without exposing destructive reset operations in Production.

## Environment classes

- Development: engineering-owned, resettable, synthetic data only.
- Integration: automated validation, ephemeral or isolated datasets.
- UAT: business acceptance, controlled reset windows, release-candidate builds.
- Production: real tenant data; seed/reset capabilities are unavailable.

Environment identity is server-owned and immutable at runtime. UI hiding is not a security control.

## Seed data strategy

Seed packs are versioned, deterministic, idempotent, and explicitly synthetic. Each pack records schema version, application version, random seed, scenario IDs, creation actor, and checksum.

Required sample roles:

- Platform Owner
- Tenant Owner
- System Administrator
- Laboratory Administrator
- Office Manager
- Customer Service
- Production Technician
- CAD Technician
- Ceramist
- QC Technician
- Shipping
- Billing
- Sales
- Doctor
- Read-only Auditor

## Demonstration scenarios

1. New Practice and Doctor onboarding
2. Manual digital case with STL and shade photograph
3. Physical case with mandatory Digital Prescription
4. Implant case requiring clinical review
5. Internal and outsourced routing examples
6. Communication timeline and notification lifecycle
7. QC rework followed by pass
8. Shipment delivery and invoice lifecycle
9. Tax-exempt and taxable customer examples when Tax is implemented
10. Suspended/reactivated tenant examples when Licensing is implemented

## Reset architecture

A reset is an asynchronous administrative command available only when `environment ∈ {development, uat}`. It requires:

- administrator permission;
- environment allowlist;
- exact tenant or sandbox scope;
- typed confirmation token;
- reason;
- current backup/snapshot reference where applicable;
- idempotency key;
- immutable audit.

The reset workflow suspends jobs, deletes only approved sandbox tenant data in dependency order, clears ObjectStorage objects for that sandbox, reapplies seed packs, verifies counts and checksums, and resumes jobs. Failure leaves the environment locked for review.

## UAT domain model

- `uat_test_plan`: release, sprint, module, owner, status, target environment, completion percent.
- `uat_test_case`: category, preconditions, steps, expected result, priority, module, version.
- `uat_execution`: tester, build, environment, start/end, outcome, actual result.
- `uat_attachment`: ObjectStorage reference.
- `uat_comment`: append-only discussion record.
- `uat_defect`: title, description, severity, priority, status, assignee, build, commit, related test case.
- `uat_approval`: role, approver, decision, timestamp, conditions.

## Defect lifecycle

```text
New → Triaged → In Progress → Ready for Retest → Verified → Closed
                  └──────────────→ Reopened ──────────────┘
```

Rejected and duplicate defects remain historically visible. Status transitions require authorization and append immutable history.

## Acceptance criteria by module

Each module requires:

- authorized happy-path completion;
- denied unauthorized access;
- tenant isolation;
- persistence across restart;
- audit evidence;
- validation and error recovery;
- browser accessibility for critical workflows;
- rollback or compensation behavior;
- documented deferred limitations.

## Certification exit criteria

- all required test cases executed;
- no open Critical or High defects;
- Medium defects have approved disposition;
- Runtime Validation and complete Playwright pass on the same build;
- migration/rollback evidence current;
- Engineering, QA, Operations, Product Owner, and Administrator approvals complete;
- release notes, ADRs, manifest, and deferred work current.

## Security

- UAT data must be synthetic or formally de-identified.
- Attachments use ObjectStorage and safe download paths.
- Reset APIs are not registered in Production.
- Test credentials are environment-specific and never reused in Production.
- Defects must not contain secrets or unnecessary clinical data.

## Deferred

- runtime UAT module;
- defect UI;
- seed generator implementation;
- snapshot provider;
- automated certification workflow.