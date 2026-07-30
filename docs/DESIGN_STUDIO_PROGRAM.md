# CADence Design Studio Program

## Program status

Design Studio is a separate CADence product program. It is not an ERP module and must not be merged into NorthStar's internal domain model, database, authorization implementation or release cadence.

Current status: **governance foundation established; runtime implementation not started**.

Canonical Design Studio documents:

- `docs/design-studio/DESIGN_STUDIO_ARCHITECTURE_BIBLE.md`
- `docs/design-studio/MODULE_REGISTRY.md`
- `docs/design-studio/ROADMAP.md`
- `docs/design-studio/TECHNICAL_DEBT.md`
- `docs/design-studio/ENGINEERING_DASHBOARD.md`

## Product responsibility

Design Studio will own dental design and visualization experiences, including future:

- case-linked design workspaces;
- 3D artifact viewing and authoring;
- design projects, sessions, revisions and approvals;
- scene, selection, command, history and undo/redo state;
- CAD engine and plugin adapters;
- derived design artifacts and provenance;
- mesh analysis and preparation tooling;
- validation and Digital QC;
- manufacturing-ready design handoff;
- governed design automation and AI assistance.

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

## Knowledge Platform responsibility

The Knowledge Platform is a third, independent CADence program. It owns future governed proprietary knowledge such as:

- Morphology Library;
- clinical and QC rules;
- material intelligence;
- restoration templates;
- manufacturer libraries;
- manufacturing profiles;
- provenance, approval, versioning, licensing and distribution.

Canonical registration: `docs/knowledge-platform/KNOWLEDGE_PLATFORM_PROGRAM.md`.

Design Studio consumes immutable knowledge versions through approved contracts. Morphology implementation is not authorized until Knowledge Platform governance and content approval are complete.

## Product boundary

```text
NorthStar ERP
  ├─ owns business, clinical-intake and operational records
  ├─ authorizes access to a case/design request
  └─ issues versioned commands/events
          ↓
Design Studio
  ├─ owns projects, scenes, commands and design artifacts
  ├─ records tool/engine/knowledge provenance and revisions
  └─ returns approved artifacts and status events
          ↑
Knowledge Platform
  ├─ owns approved morphology, rules, templates and profiles
  └─ publishes immutable versioned knowledge packages
```

No product may write directly to another product's internal database tables.

## Integration principles

- Versioned REST/event contracts.
- Explicit tenant, Practice, case and actor context.
- Short-lived, purpose-bound artifact access.
- Immutable provenance for source files, transformations, knowledge versions, engine versions and approvals.
- Idempotent commands and event delivery.
- No shared session cookie unless an approved identity-federation design exists.
- No Design Studio UI embedded into NorthStar by copying components; integration uses stable product boundaries.
- No NorthStar ERP workflow ownership transferred to Design Studio.
- Feature entitlement and authorization are evaluated independently.
- Knowledge Platform responses never grant entity authorization or autonomous clinical authority.

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
- Resolve immutable Knowledge Platform asset versions.

## Security considerations

- Every request is tenant-bound and case-authorized.
- Platform support has no implicit tenant access.
- Design artifacts use managed ObjectStorage references, checksums and controlled download/upload paths.
- Clinical content is excluded from unapproved logs and telemetry.
- AI or automated design recommendations require model/version provenance, confidence and human approval policy.
- External CAD engines are provider adapters and cannot become identity or authorization authorities.
- Proprietary Knowledge Platform assets require entitlement and controlled distribution.

## Independent architecture

Design Studio maintains its own:

- architecture Bible;
- module registry;
- ADR index;
- roadmap;
- technical-debt register;
- engineering dashboard;
- release manifest;
- validation pipelines;
- UAT plan.

NorthStar documentation records only cross-product boundaries and integration milestones.

## Future milestones

1. **Design Studio Governance Baseline**
   - architecture, registry, roadmap, debt, dashboard and Knowledge ownership.
2. **Foundation Planning**
   - rendering, geometry, persistence, scene, command/history, performance and integration ADRs.
3. **Viewer Preview**
   - authorized read-only STL/OBJ/PLY visualization and measurement.
4. **Design Session Foundation**
   - projects, revisions, checkpoints, undo/redo, review and approval.
5. **Validation and Digital QC**
   - governed checks and evidence.
6. **Knowledge Library Integration**
   - immutable versioned morphology/material/template/profile consumption.
7. **Controlled Editing**
   - selection, transforms, cut, repair and sculpt under approved guardrails.
8. **Manufacturing Handoff**
   - approved artifact packaging, versioning and production events.
9. **Plugin, CAD and AI Extensions**
   - governed adapters, compute and human-reviewed assistance.

## Governance rule

A NorthStar sprint may add a Design Studio integration contract only when the Design Studio side has an approved matching contract. Design Studio feature implementation must occur in its own repository or explicitly separated product workspace and release process.

No Morphology implementation may begin until Knowledge Platform governance, provenance, licensing, taxonomy, validation and distribution controls are approved.