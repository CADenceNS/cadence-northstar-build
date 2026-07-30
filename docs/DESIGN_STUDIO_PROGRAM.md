# CADence Design Studio Program

## Program status

Design Studio is a separate CADence product program. It is not an ERP module and must not be merged into NorthStar's internal domain model, database, authorization implementation or release cadence.

Current status: Governance registered; implementation managed independently.

## Product responsibility

Design Studio will own dental design and visualization experiences, including future:

- case-linked design workspaces;
- 3D artifact viewing and authoring;
- design revisions and approvals;
- CAD engine adapters;
- derived design artifacts;
- mesh analysis and preparation tooling;
- manufacturing-ready design handoff;
- design-specific automation and AI assistance.

## NorthStar responsibility

NorthStar ERP remains the source of truth for:

- tenant and user identity;
- Practices, Doctors, patients and cases;
- prescriptions and intake files;
- production status and assignments;
- QC, shipping and Billing;
- operational Communications;
- security audit and UAT evidence.

Design Studio must not duplicate those records as an independent business system.

## Product boundary

```text
NorthStar ERP
  ├─ owns business, clinical-intake and operational records
  ├─ authorizes access to a case/design request
  └─ issues versioned commands/events
          ↓
Design Studio
  ├─ owns design sessions and design artifacts
  ├─ records tool/engine provenance and revisions
  └─ returns approved artifacts and status events
```

Neither product may write directly to the other's internal database tables.

## Integration principles

- Versioned REST/event contracts.
- Explicit tenant, Practice, case and actor context.
- Short-lived, purpose-bound artifact access.
- Immutable provenance for source files, transformations, engine versions and approvals.
- Idempotent commands and event delivery.
- No shared session cookie unless an approved identity federation design exists.
- No Design Studio UI embedded into NorthStar by copying components; integration uses stable product boundaries.
- No NorthStar ERP workflow ownership transferred to Design Studio.
- Feature entitlement and authorization are evaluated independently.

## Initial integration contracts to design

- Create design request.
- Retrieve authorized source-artifact references.
- Record design-session state.
- Publish design revision.
- Submit design for review.
- Approve/reject design.
- Return approved design artifacts.
- Emit design-status and failure events.
- Request manufacturing handoff.

## Security considerations

- Every request is tenant-bound and case-authorized.
- Platform support has no implicit tenant access.
- Design artifacts use managed ObjectStorage references, checksums and controlled download/upload paths.
- Clinical content is excluded from unapproved logs and telemetry.
- AI or automated design recommendations require model/version provenance, confidence and human approval policy.
- External CAD engines are provider adapters and cannot become identity or authorization authorities.

## Independent architecture

Design Studio should maintain its own:

- architecture Bible;
- module registry;
- ADR index;
- roadmap;
- technical-debt register;
- release manifest;
- validation pipelines;
- UAT plan.

NorthStar documentation records only cross-product boundaries and integration milestones.

## Future milestones

1. **Design Studio Architecture Baseline**
   - domain model, artifact model, provenance, authorization contract and ADRs.
2. **Viewer Preview**
   - authorized read-only STL/OBJ/PLY visualization.
3. **Design Session Foundation**
   - revisions, autosave, locking, review and approval.
4. **CAD Adapter Foundation**
   - licensed engine adapters, job orchestration and failure recovery.
5. **Manufacturing Handoff**
   - approved artifact packaging, versioning and production events.
6. **Automation and AI Assistance**
   - governed recommendations with human review and audit.

## Governance rule

A NorthStar sprint may add a Design Studio integration contract only when the Design Studio side has an approved matching contract. Design Studio feature implementation must occur in its own repository or explicitly separated product workspace and release process.