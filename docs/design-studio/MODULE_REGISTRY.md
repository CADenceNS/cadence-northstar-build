# CADence Design Studio Module Registry

## Purpose

Canonical status registry for every Design Studio subsystem. Percentages are governance estimates against approved scope, not test coverage or release guarantees.

Every Design Studio sprint must update this file.

## Status vocabulary

- **Governance complete** — ownership and boundaries approved; no runtime implied.
- **Planned** — approved future work, not started.
- **Foundation required** — prerequisite architecture exists but implementation is absent.
- **Deferred** — intentionally postponed.
- **Separate platform dependency** — owned outside Design Studio.

## Registry

| Module | Purpose | Status | Dependencies | Completion | Current sprint | Next milestone |
|---|---|---|---|---:|---|---|
| Product Shell | Desktop/web application frame, workspace lifecycle, commands and diagnostics | Planned | Identity contract, project manager | 10% | Governance | Viewer foundation |
| Viewer | Non-destructive 3D inspection and visualization | Planned | Rendering, file import, scene manager | 15% | Governance | Load and inspect reference STL/OBJ/PLY fixtures |
| Rendering Engine | GPU-backed scene rendering, materials, clipping, overlays and performance metrics | Foundation required | Viewer, scene snapshots | 10% | Governance | Select rendering stack and benchmark harness |
| Scene Manager | Serializable scene graph, nodes, transforms, visibility and coordinate frames | Planned | Project manager, artifact registry | 10% | Governance | Scene model ADR and serialization tests |
| Navigation | Camera orbit, pan, zoom, presets and view controls | Planned | Viewer, rendering engine | 10% | Governance | Reference navigation behavior |
| Selection Engine | Object, face, edge, vertex and region selection | Planned | Scene manager, geometry identifiers | 5% | Governance | Stable selection identity model |
| Transform Tools | Translate, rotate, scale, align and coordinate transforms | Planned | Selection, command bus, history | 5% | Governance | Command/inverse contract |
| Cut Tools | Planar and controlled geometry cutting/segmentation | Deferred | Selection, mesh kernel, history | 5% | Governance | Geometry-kernel decision |
| Sculpt Tools | Brush-based add/remove/smooth and controlled mesh deformation | Deferred | Mesh kernel, history, performance | 5% | Governance | Sculpt command architecture |
| Measurement Tools | Distance, angle, thickness, clearance and section measurements | Planned | Viewer, selection, units | 10% | Governance | Measurement vertical slice |
| Annotation Tools | Notes, markers, snapshots and review comments | Planned | Scene manager, review | 10% | Governance | Review annotation schema |
| File Import | Validated ingestion, parsing, checksum, units and orientation | Planned | Object storage, parser adapters | 15% | Governance | Reference-file import pipeline |
| File Export | Versioned design and manufacturing export packages | Planned | Artifact registry, validation | 5% | Governance | Export manifest contract |
| Artifact Registry | Source, working, derived, preview and export artifact lineage | Planned | Storage, project manager | 10% | Governance | Artifact/provenance model |
| Project Manager | Design projects, sessions, revisions, state and case references | Planned | NorthStar integration, persistence | 10% | Governance | Project lifecycle ADR |
| History Manager | Append-only command/provenance history and checkpoints | Planned | Command bus, persistence | 10% | Governance | History/checkpoint model |
| Undo / Redo | Deterministic reversal/restoration of modifying operations | Foundation required | History, command inverses, checkpoints | 5% | Governance | Undo round-trip prototype |
| Command Bus | Versioned tool-command validation and execution | Planned | Project, history, authorization | 10% | Governance | Command contract and test harness |
| Validation Engine | File, geometry, project and handoff validation orchestration | Planned | Artifact registry, rules gateway | 10% | Governance | Validation-result contract |
| Digital QC | Design-level QC checks, evidence and review outcomes | Planned | Validation, Knowledge Platform rules | 5% | Governance | Initial non-clinical QC checks |
| Design Review | Human review, annotations, approval/rejection and revision requests | Planned | Viewer, project, communications contract | 10% | Governance | Review lifecycle model |
| Library Manager | Resolves governed library assets and pinned versions | Planned | Knowledge Platform | 10% | Governance | Library gateway contract |
| Morphology Library | Proprietary morphology content and versions | Separate platform dependency | Knowledge Platform | 5% | Governance | Knowledge governance only; no morphology implementation |
| Manufacturer Libraries | Governed component/manufacturer reference assets | Separate platform dependency | Knowledge Platform, provider licenses | 5% | Governance | Manufacturer asset model |
| Material Profiles | Material properties, compatibility and design constraints | Separate platform dependency | Knowledge Platform | 5% | Governance | Material profile schema |
| Restoration Templates | Governed starting templates and parameters | Separate platform dependency | Knowledge Platform | 5% | Governance | Template versioning contract |
| Manufacturing Profiles | Machine/CAM/process capability references | Separate platform dependency | Knowledge Platform, manufacturing adapters | 5% | Governance | Handoff compatibility contract |
| NorthStar Integration Gateway | Case context, authorization, artifact references and events | Planned | NorthStar contracts, service identity | 15% | Governance | Versioned project-initiation contract |
| Manufacturing Handoff | Approved export package for downstream CAM/manufacturing | Planned | Export, validation, review | 5% | Governance | Handoff manifest and conformance rules |
| Plugin Framework | Sandboxed import/export/CAD/AI/provider extensions | Planned | Capability model, security, job execution | 5% | Governance | Plugin ADR and capability manifest |
| CAD Engine Adapters | Licensed or internal geometry/CAD engine connectors | Deferred | Plugin framework, compute jobs | 0% | Governance | Evidence-based engine evaluation |
| AI Assistance | Explainable recommendations and automation proposals | Deferred | Knowledge Platform, model governance | 0% | Governance | AI policy and evaluation framework |
| Persistence | Independent project, command, scene, artifact and review persistence | Planned | Database/object storage choices | 10% | Governance | Persistence ADR |
| Job/Compute Runtime | Asynchronous parse, validation, conversion and heavy geometry jobs | Planned | Outbox/queue, workers, observability | 5% | Governance | Compute-job architecture |
| Security & Tenancy | Tenant isolation, authorization, entitlements and support access | Planned | NorthStar identity, licensing | 15% | Governance | Threat model and tenant tests |
| Diagnostics & Observability | Rendering, memory, command, plugin and job telemetry | Planned | All runtime modules | 10% | Governance | Diagnostic event model |
| Test & Benchmark Harness | Geometry fixtures, visual regression, performance and memory baselines | Planned | Viewer/rendering/import | 10% | Governance | Reference fixture suite |
| Release & UAT | Installer/build, validation, technician UAT and release manifests | Planned | Product shell, validation | 10% | Governance | Viewer preview release discipline |

## Current totals

- Registered subsystems: 35
- Runtime-complete subsystems: 0
- Governance-defined or partially defined: 35
- Deferred runtime subsystems: 5
- External Knowledge Platform dependencies: 5

## Update rule

A module may not move to a higher status without:

- implemented scope reference;
- tests and validation evidence;
- updated dependencies and debt;
- exact commit or release evidence;
- revised next milestone.