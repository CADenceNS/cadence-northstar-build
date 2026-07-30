# CADence Design Studio Architecture Bible

## Status

Permanent architecture and engineering-governance reference for CADence Design Studio. This document defines approved boundaries and future implementation direction only. It does not claim Morphology, CAD editing, manufacturing, or AI functionality is implemented.

## 1. Vision

CADence Design Studio is a professional dental design environment for viewing, preparing, editing, reviewing, validating, and handing off digital dental design artifacts. It is a separate product from NorthStar ERP and from the future Knowledge Platform.

Design Studio should give technicians a safe, explainable, reversible workspace for digital restorative design while preserving clinical provenance, source-file integrity, design history, and manufacturing readiness.

## 2. Product scope

Design Studio may eventually support:

- STL, OBJ, PLY, DICOM-derived and other approved dental file formats;
- deterministic 3D viewing and scene composition;
- selection, transform, measurement, cut, sculpt, alignment, inspection, and review tools;
- versioned design projects and derived artifacts;
- design validation and digital QC;
- morphology, manufacturer, material, and manufacturing-profile libraries obtained through governed Knowledge Platform contracts;
- manufacturing handoff to approved downstream systems;
- plugin-based CAD engine and automation integrations.

## 3. Product boundaries

### Design Studio owns

- design projects and design sessions;
- scene graphs and viewport state;
- imported design working copies and derived artifacts;
- tool commands, selections, transforms, edit history, undo/redo, and checkpoints;
- design validation results and review annotations;
- plugin execution boundaries;
- manufacturing handoff packages and design provenance.

### NorthStar owns

- tenants, users, Practices, Doctors, patients, cases, prescriptions, workflow, production, QC, shipping, billing, communications, and security audit;
- authoritative case identity and permission context;
- source clinical submissions and operational status.

### Knowledge Platform owns

- proprietary Morphology Library;
- clinical rules and QC knowledge;
- material intelligence;
- restoration templates;
- manufacturer and manufacturing profiles;
- knowledge versioning, provenance, approval, licensing, and distribution.

No product may directly write another product’s internal tables. Integration uses versioned, authenticated, authorized contracts.

## 4. Architectural principles

- Independent product architecture with explicit integration contracts.
- Non-destructive editing and immutable source-artifact preservation.
- Every derived artifact records source, tool, parameters, actor, version, and timestamp.
- Command-based tools support deterministic replay where practical.
- Undo/redo is a first-class architectural capability, not a UI patch.
- Rendering state is separated from domain/project state.
- Large-file and compute work is asynchronous where required.
- Plugins receive least-privilege capabilities and cannot bypass validation or authorization.
- Knowledge assets are referenced by immutable version, never copied as ungoverned embedded truth.
- Clinical and manufacturing recommendations remain explainable and subject to human approval.
- Performance budgets and memory limits are defined before broad deployment.

## 5. Reference architecture

```text
NorthStar Case Context
        |
        v
Design Studio Integration Gateway
        |
        +--> Project Manager
        |       +--> File/Artifact Registry
        |       +--> History Manager
        |       +--> Review/Approval
        |
        +--> Scene Manager
        |       +--> Viewer/Renderer
        |       +--> Navigation
        |       +--> Selection Engine
        |       +--> Tool Command Bus
        |
        +--> Validation Engine / Digital QC
        |
        +--> Library Gateway --------> Knowledge Platform
        |
        +--> Plugin Host ------------> CAD/AI/Manufacturer adapters
        |
        +--> Manufacturing Handoff
```

## 6. Rendering architecture

The rendering subsystem is a presentation and interaction engine. It must not become the authority for project data.

Responsibilities:

- GPU-backed rendering and viewport composition;
- camera, lighting, clipping, materials, overlays, annotations, and selection highlighting;
- level-of-detail and progressive loading;
- deterministic mapping from scene state to rendered output;
- rendering diagnostics, frame timing, memory usage, and device capability detection.

Boundaries:

- renderer consumes immutable or versioned scene snapshots;
- renderer does not persist clinical or project truth;
- visual shaders may not silently alter geometry;
- render-only simplification must remain distinct from manufacturing geometry;
- unsupported hardware must degrade safely with clear capability reporting.

Initial performance goals:

- interactive viewport target: 60 FPS on supported workstation hardware;
- acceptable minimum during complex manipulation: 30 FPS;
- first useful render for ordinary single-arch assets: under 3 seconds on reference hardware;
- no unbounded GPU or browser-memory growth across project open/close cycles.

Final budgets require benchmark fixtures and supported-device policy.

## 7. File architecture

File architecture separates source artifacts, working artifacts, derived artifacts, previews, and manufacturing exports.

Each artifact records:

- artifact ID and tenant/product scope;
- project and optional NorthStar case reference;
- format, MIME type, size, checksum, and storage reference;
- source/derived classification;
- parent artifact and derivation chain;
- coordinate-system and unit metadata;
- import parser/version;
- validation status;
- creator and timestamps;
- retention and legal-hold metadata where applicable.

Import pipeline:

`Receive → checksum → type validation → malware/quarantine boundary → parse → unit/orientation validation → geometry diagnostics → normalized working copy → preview generation → project association`

Source bytes remain immutable. Corrections create new artifacts.

## 8. Scene architecture

A scene is a versioned composition of artifact instances and interaction state.

Core concepts:

- Scene
- Scene Node
- Geometry Instance
- Transform
- Camera
- Light
- Clip Plane
- Annotation
- Selection Set
- Visibility Group
- Tool Overlay
- Coordinate Frame

Scene state is serializable, deterministic, and independent of the renderer. Nodes reference artifacts; they do not duplicate uncontrolled geometry bytes.

## 9. Tool architecture

Tools execute through a command boundary.

Every modifying command defines:

- command type and version;
- required permissions and capabilities;
- input artifact/selection versions;
- parameters and units;
- validation and preconditions;
- deterministic output or declared nondeterminism;
- inverse operation or checkpoint requirement;
- generated artifacts and measurements;
- audit/provenance metadata.

Tool families:

- navigation and inspection;
- selection;
- transforms and alignment;
- measurement;
- cutting and segmentation;
- sculpting and smoothing;
- repair and normalization;
- design review and annotations;
- validation and digital QC;
- manufacturing preparation.

Morphology-driven tools are explicitly deferred until Knowledge Platform governance and content contracts are approved.

## 10. Library architecture

Design Studio consumes libraries through a `Library Gateway` rather than owning proprietary clinical knowledge.

Library types:

- Morphology Library;
- restoration templates;
- manufacturer libraries;
- implant/component references;
- material profiles;
- manufacturing profiles;
- clinical and QC rules.

Every library asset requires immutable identity, semantic version, provenance, approval state, compatibility, licensing, effective dates, and deprecation policy.

Projects pin the exact library versions used so historical designs remain reproducible.

## 11. Viewer architecture

The Viewer is the non-destructive inspection surface and foundation for later editing.

Capabilities planned:

- multi-format model loading;
- camera presets and free navigation;
- orthographic/perspective views;
- visibility, isolation, transparency, clipping, and section views;
- measurement and annotations;
- artifact metadata and validation panels;
- synchronized scene tree;
- review links and snapshots.

The Viewer must remain usable without enabling modifying CAD tools.

## 12. Plugin architecture

Plugins may provide importers, exporters, analysis tools, CAD engines, AI services, manufacturer adapters, or manufacturing connectors.

Plugin requirements:

- signed and versioned package identity;
- declared capabilities and permissions;
- compatibility matrix;
- sandboxed execution where technically possible;
- time, memory, file, and network limits;
- explicit tenant/license entitlement;
- validated inputs and outputs;
- structured diagnostics;
- kill, retry, quarantine, and rollback behavior;
- no direct database access;
- no unapproved clinical or manufacturing authority.

## 13. NorthStar integration contracts

NorthStar may initiate a Design Studio project through a versioned command containing:

- tenant and authorized actor context;
- case and prescription references;
- authorized source-artifact references;
- requested design purpose;
- required outputs and review policy;
- correlation and idempotency keys.

Design Studio may publish:

- project created/updated;
- artifact derived;
- validation completed;
- review requested/approved/rejected;
- manufacturing handoff prepared;
- project failed or blocked.

NorthStar remains responsible for operational workflow decisions. Design Studio does not directly advance ERP cases, invoice customers, or alter prescriptions.

## 14. Future manufacturing interfaces

Manufacturing handoff is a governed export boundary, not direct machine control in the initial platform.

A handoff package may contain:

- approved geometry and checksum;
- restoration/material/manufacturer profile versions;
- units, orientation, coordinate frames, and tolerances;
- nesting/CAM requirements where applicable;
- case and project correlation;
- approval and validation evidence;
- revision and supersession information.

Future CAM, printer, mill, and manufacturing execution adapters must remain provider-neutral and independently validated.

## 15. Security and tenancy

- Every project, artifact, scene, command, library entitlement, review, and export is tenant-scoped.
- NorthStar-issued context must be cryptographically verifiable or resolved through trusted service identity.
- Project access requires both product entitlement and entity authorization.
- Internal object keys and provider credentials are never public API fields.
- Exports and plugin executions are audited.
- Platform support access is explicit, expiring, scoped, and audited.

## 16. Persistence and history

Design Studio requires separate persistence for project metadata, commands, checkpoints, artifacts, reviews, and plugin executions. It must not share NorthStar ERP tables.

History strategy:

- immutable source artifacts;
- append-only command/provenance records;
- periodic checkpoints for efficient restoration;
- branchable design revisions where approved;
- explicit supersession and approval states;
- reproducible export manifests.

## 17. Validation strategy

Future implementation requires:

- parser and geometry fixture tests;
- deterministic command tests;
- undo/redo round-trip tests;
- scene serialization tests;
- visual regression tests;
- rendering-performance and memory tests;
- plugin isolation tests;
- tenant-isolation and authorization tests;
- artifact checksum and provenance tests;
- manufacturing-export conformance tests;
- full Runtime and workstation UAT validation.

## 18. Development lifecycle

`Architecture → Vertical Viewer Slice → Engineering Validation → Reliability/Performance → Technician UAT → Release Candidate → Controlled Preview`

Every Design Studio sprint updates:

- this Bible when boundaries change;
- `MODULE_REGISTRY.md`;
- `ROADMAP.md`;
- `TECHNICAL_DEBT.md`;
- `ENGINEERING_DASHBOARD.md`;
- ADRs for material decisions.

## 19. Initial milestone sequence

1. Governance and architecture foundation.
2. Viewer and file-ingestion proof of foundation.
3. Project, scene, history, and measurement foundations.
4. Selection and transform tools.
5. Validation and Digital QC foundation.
6. Design Review and NorthStar integration.
7. Knowledge Platform library consumption.
8. Controlled editing tools.
9. Manufacturing handoff.
10. Plugin/CAD/AI extensions.

Morphology implementation is not authorized by this document.