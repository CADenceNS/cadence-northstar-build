# CADence Design Studio Roadmap

## Purpose

Permanent sequencing record for Design Studio. Every future Design Studio sprint updates this document. Work may not disappear; cancelled or superseded work moves to Deferred with rationale.

## Completed

### Engineering governance foundation

- Design Studio registered as a separate CADence product.
- Product boundaries with NorthStar ERP established.
- Knowledge Platform dependency and ownership established.
- Architecture Bible published.
- Module Registry published.
- Technical Debt Register published.
- Engineering Dashboard published.
- Morphology implementation explicitly deferred.

## Current Development

### Governance and program establishment

- Validate architecture, registry, roadmap, debt, dashboard, and Knowledge Platform ownership.
- Confirm no Design Studio runtime exists in NorthStar ERP modules.
- Establish future ADR sequence and validation standards.
- Preserve approved NorthStar UI and ERP behavior.

No CAD implementation is authorized in this phase.

## Next Sprint

### Design Studio Foundation Planning

Architecture and technical-spike scope only unless separately approved:

- select reference rendering technology and supported workstation/browser envelope;
- define source/working/derived artifact model;
- define project and scene serialization contracts;
- define command/history/undo architecture;
- define benchmark fixtures and performance budgets;
- define NorthStar project-initiation and artifact-reference contract;
- define threat model, tenant boundary, and plugin capability model;
- prepare ADRs for rendering, geometry kernel, persistence, and job execution.

Expected exit: implementation-ready plan for a narrow Viewer vertical slice.

## Future

### Viewer Preview

- import approved STL/OBJ/PLY fixtures;
- validated units, orientation, checksum, and parser metadata;
- scene tree and camera controls;
- visibility, isolation, transparency, clipping, and snapshots;
- measurement foundation;
- performance and memory diagnostics;
- independent project persistence;
- technician UAT.

### Project and History Foundation

- design projects and sessions;
- artifact lineage;
- command bus;
- checkpoints;
- undo/redo round-trip validation;
- revision and review states.

### Selection and Transform Foundation

- stable geometry identifiers;
- object/region selection;
- translate, rotate, scale, and align;
- deterministic command replay;
- selection and transform visual regressions.

### Validation and Digital QC

- geometry and artifact checks;
- validation evidence;
- non-clinical Digital QC foundation;
- review and approval workflows;
- governed Knowledge Platform rule consumption.

### Knowledge Library Integration

- Library Gateway;
- immutable version pinning;
- morphology, material, manufacturer, restoration, and manufacturing-profile references;
- entitlement and licensing checks;
- content provenance and compatibility.

### Controlled Editing

- cut and segmentation;
- repair and normalization;
- sculpt and smoothing;
- clinical guardrails and human approval;
- performance qualification.

### Manufacturing Handoff

- approved design export manifest;
- material/manufacturer/profile references;
- coordinate, unit, orientation, tolerance, and checksum evidence;
- CAM/manufacturing adapter contracts;
- conformance testing.

### Plugin and CAD Engine Platform

- signed plugin packages;
- capability sandbox;
- import/export adapters;
- licensed CAD engine adapters;
- compute workers and job governance;
- failure, retry, quarantine, and observability.

### Governed AI Assistance

- explainable recommendations;
- model/version provenance;
- confidence and limitation display;
- human approval;
- evaluation, monitoring, and rollback.

## Deferred

- Morphology content implementation before Knowledge Platform approval.
- Direct machine control.
- Autonomous clinical decision-making.
- Autonomous manufacturing release.
- Patient-facing design experiences.
- Unlicensed third-party CAD engine integration.
- Shared database tables with NorthStar ERP.
- Embedded unversioned clinical rules.

## Milestone lifecycle

`Planning → Engineering Validation → Reliability/Performance → Technician UAT → Release Candidate → Controlled Preview → Beta → General Availability`

## Roadmap update requirements

Every change records:

- moved item and prior category;
- reason and dependency impact;
- responsible product/program;
- related ADR or design decision;
- validation and release consequences.