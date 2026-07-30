# CADence Design Studio Technical Debt Register

## Purpose

Tracks known architectural risk, unresolved decisions, temporary assumptions, and future engineering debt before Design Studio implementation begins.

Priority:

- **P0** — blocks safe implementation or release.
- **P1** — must be addressed in the next relevant foundation milestone.
- **P2** — planned improvement before Beta or broad deployment.
- **P3** — optimization or long-term research.

## Register

| ID | Area | Debt / Risk | Priority | Owner | Recommended resolution | Status |
|---|---|---|---|---|---|---|
| DS-TD-001 | Rendering | Rendering technology and supported hardware envelope are not selected | P0 | Design Studio Architecture | Benchmark candidate stacks with representative dental models; publish ADR | Open |
| DS-TD-002 | Geometry | No approved geometry kernel or stable mesh-identity strategy | P0 | Geometry Engineering | Evaluate kernels, licensing, determinism, precision, topology identity, and rollback | Open |
| DS-TD-003 | Undo | Undo/redo command and checkpoint strategy is architectural only | P0 | Design Studio Architecture | Prototype command inverses plus checkpoints; prove round-trip restoration | Open |
| DS-TD-004 | File Import | Parser security, quarantine, malformed-file handling, units, and orientation policies are not implemented | P1 | File Platform | Build isolated fixture corpus and provider-neutral parser adapters | Open |
| DS-TD-005 | Persistence | Independent Design Studio persistence technology and schema are undecided | P0 | Platform Architecture | Publish persistence ADR; separate project metadata from artifact bytes | Open |
| DS-TD-006 | Scene | Scene serialization/versioning and backward compatibility are undefined | P1 | Viewer Engineering | Define versioned scene schema and migration tests | Open |
| DS-TD-007 | Memory | No memory budgets or leak-detection baseline exist | P1 | Rendering Engineering | Establish reference hardware, repeated open/close tests, heap/GPU monitoring | Open |
| DS-TD-008 | Performance | No frame-time, load-time, or interaction-latency benchmark suite exists | P1 | Engineering Reliability | Create representative fixtures and automated benchmark thresholds | Open |
| DS-TD-009 | Rendering | Visual regression strategy is undefined | P1 | QA / Rendering | Implement deterministic camera, lighting, fixtures, and screenshot tolerances | Open |
| DS-TD-010 | Mesh Handling | Large-mesh level-of-detail and progressive loading are unqualified | P2 | Rendering / Geometry | Prototype chunking, LOD, worker transfer, and cancellation | Open |
| DS-TD-011 | Selection | Stable face/edge/vertex identity across edits is unresolved | P0 | Geometry Engineering | Define topology identity and selection remapping contract | Open |
| DS-TD-012 | History | Command-log growth and checkpoint compaction policy are undefined | P2 | Project Platform | Model retention, compaction, branch, replay, and corruption recovery | Open |
| DS-TD-013 | Concurrency | Concurrent editing, review, and revision conflict policy is undefined | P2 | Product Architecture | Start single-writer model; document future optimistic concurrency | Open |
| DS-TD-014 | Storage | Managed ObjectStorage provider, signed access, retention, and legal holds are not selected | P1 | Platform Infrastructure | Reuse approved provider-neutral contract with separate Design Studio namespace | Open |
| DS-TD-015 | Security | Product-specific threat model is not complete | P0 | Security Architecture | Threat-model files, plugins, exports, service identity, tenant access, and support grants | Open |
| DS-TD-016 | Plugins | Plugin sandbox, signature, capability, and resource-limit model is undefined | P1 | Plugin Platform | Publish plugin ADR before third-party or CAD-engine integration | Open |
| DS-TD-017 | Jobs | No asynchronous compute/job runtime is implemented | P1 | Platform Infrastructure | Define outbox, queue, workers, idempotency, cancellation, retry, and dead letter | Open |
| DS-TD-018 | Viewer | Accessibility strategy for a 3D technical workspace is incomplete | P2 | UX / Accessibility | Define keyboard navigation, focus, labels, alternatives, contrast, and reduced motion | Open |
| DS-TD-019 | Viewer | Cross-browser and workstation support matrix is undefined | P1 | QA / Product | Establish supported browsers, GPUs, drivers, memory, and fallback policy | Open |
| DS-TD-020 | Import Pipeline | DICOM-derived and CBCT processing boundaries require clinical/security review | P2 | Clinical Platform | Keep raw clinical processing deferred; define approved derived-artifact contract | Open |
| DS-TD-021 | Export | Manufacturing export conformance and tolerance validation are undefined | P1 | Manufacturing Integration | Define versioned handoff manifest and golden conformance fixtures | Open |
| DS-TD-022 | Libraries | Knowledge Platform APIs, licensing, and cache invalidation do not exist | P1 | Knowledge Platform | Establish immutable versioned library contract before morphology use | Open |
| DS-TD-023 | Morphology | Morphology is named in planning but no governed content source or approval process exists | P0 | Knowledge Platform | Do not implement; establish ownership, provenance, validation, and licensing first | Open |
| DS-TD-024 | Materials | Material constraints and compatibility are architecture-only | P2 | Knowledge Platform | Define governed material profile schema and evidence sources | Open |
| DS-TD-025 | Manufacturer Data | Manufacturer libraries may carry licensing and update obligations | P2 | Commercial / Knowledge | Create provider agreements, provenance, versioning, and deprecation process | Open |
| DS-TD-026 | NorthStar Integration | Project initiation and event contracts are not versioned runtime contracts | P1 | Cross-Product Architecture | Publish contract schemas, idempotency, authorization, and compatibility tests | Open |
| DS-TD-027 | Identity | Design Studio entitlement and service-to-service identity are not implemented | P1 | Security / Licensing | Depend on future commercial control plane; prohibit local bypass | Open |
| DS-TD-028 | Digital QC | Clinical authority, sensitivity, and false-positive policy are undefined | P1 | Clinical Governance | Start with non-clinical checks; require approved rule provenance and human review | Open |
| DS-TD-029 | AI | AI model governance, evaluation, monitoring, and rollback are absent | P2 | AI Governance | Defer runtime; define model registry and approval policy before use | Deferred |
| DS-TD-030 | Release | No Design Studio installer, deployment model, or release manifest exists | P1 | Release Engineering | Define build packaging during Viewer foundation | Open |
| DS-TD-031 | Recovery | Project/artifact backup, restore, and corruption-recovery procedures are undefined | P1 | Reliability / Infrastructure | Define RPO/RTO and restore drills before controlled preview | Open |
| DS-TD-032 | Testing | No canonical dental geometry fixture library exists | P0 | QA / Knowledge Platform | Establish synthetic/licensed fixtures with expected diagnostics and outputs | Open |
| DS-TD-033 | Precision | Numeric precision, units, tolerances, and coordinate conventions are not standardized | P0 | Geometry Architecture | Publish foundational ADR and conversion tests | Open |
| DS-TD-034 | Telemetry | Clinical/design content leakage risk in logs and traces is unassessed | P1 | Security / Observability | Define redaction, classification, sampling, and retention rules | Open |
| DS-TD-035 | CAD Engines | Build-vs-license strategy is unresolved | P3 | Product / Commercial | Evaluate only after Viewer, project, history, and plugin foundations are validated | Deferred |

## Counts

- P0: 9
- P1: 17
- P2: 8
- P3: 1
- Total: 35

## Governance rules

- Technical debt may not be deleted; resolved items record evidence and date.
- Deferred is not complete.
- A sprint that creates debt must register it before completion.
- P0 debt blocks implementation of the affected capability.
- P1 debt blocks controlled preview of the affected capability unless formally accepted with rationale.