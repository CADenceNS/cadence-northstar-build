# CADence NorthStar Platform Vision

## Vision

CADence NorthStar will become the operating platform that connects dental practices, laboratories, digital records, CAD workflows, manufacturing systems, quality intelligence, and human-supervised clinical AI.

The platform begins with a durable laboratory ERP because reliable operational truth is the prerequisite for every advanced capability. It then expands in controlled layers without abandoning the workflows, data integrity, auditability, and user trust established by the ERP foundation.

## Evolution of the platform

```text
Laboratory ERP
      ↓
Digital Workflow Platform
      ↓
Clinical Platform
      ↓
CAD Platform
      ↓
Manufacturing Platform
      ↓
AI Platform
```

This progression is cumulative. Each layer strengthens the layers below it rather than replacing them.

## Stage 1: Laboratory ERP

The ERP is the operational system of record.

It coordinates:

- Practices and prescribing doctors
- Patients and cases
- Production departments and due dates
- Quality Control
- Shipping and delivery
- Billing and accounts receivable
- Attachments, audit history, and durable persistence

The architectural goal is dependable execution. Every case should have a clear owner, current state, history, expected next action, and financial outcome.

The ERP foundation must remain understandable, auditable, recoverable, and usable even when advanced digital services are unavailable.

## Stage 2: Digital Workflow Platform

The Digital Workflow Platform connects external digital dentistry systems to the ERP.

It enables:

- Scanner and portal submissions
- Secure ingestion of STL, OBJ, PLY, DICOM/CBCT, photographs, and prescriptions
- File validation and normalization
- Case completeness checks
- Digital communications and clarifications
- Doctor-facing case visibility
- Versioned digital artifacts

The architectural goal is continuity. Digital records should move from practice to laboratory without manual re-entry, loss of context, duplication, or ambiguity.

Provider-specific integrations remain outside core business logic. The platform owns a normalized submission model and stable ingestion contracts.

## Stage 3: Clinical Platform

The Clinical Platform organizes case data into clinically meaningful views and analysis-ready records.

It enables:

- STL and DICOM visualization
- Structured preparation, margin, implant, shade, and occlusion context
- Clinical communication tied to evidence
- Human annotations and approvals
- Versioned findings and measurements
- Longitudinal quality insights

The architectural goal is clinical clarity. Users should be able to understand why a case is blocked, what evidence is available, what requires confirmation, and how a conclusion was reached.

The platform assists communication and quality; it does not silently replace professional judgment.

## Stage 4: CAD Platform

The CAD Platform coordinates digital design work and compute-intensive geometry services.

It enables:

- Mesh validation, conversion, repair, segmentation, and alignment
- CAD job creation and orchestration
- Design artifact versioning
- Review, approval, and revision history
- Integration with licensed CAD engines
- Derived geometry and analysis overlays

The architectural goal is reproducibility. Every input, transformation, design result, approval, and output should be traceable to a versioned case context.

CAD engines are treated as specialized providers. NorthStar owns orchestration, provenance, permissions, status, and artifact history.

## Stage 5: Manufacturing Platform

The Manufacturing Platform connects approved designs to physical production.

It enables:

- Material and equipment compatibility
- Milling, printing, sintering, pressing, and finishing workflows
- Nesting and job planning
- Material lot and restoration traceability
- Equipment telemetry
- Capacity and delivery forecasting
- Quality and remake feedback loops
- Multi-location production balancing

The architectural goal is controlled execution at scale. The platform should help laboratories use equipment, material, labor, and time efficiently while preserving quality requirements and case traceability.

Manufacturing automation must remain interruptible, observable, and accountable to trained users.

## Stage 6: AI Platform

The AI Platform provides human-supervised intelligence across clinical, operational, CAD, and manufacturing workflows.

It may assist with:

- Submission completeness
- Clarification recommendations
- Margin candidates
- Preparation and reduction analysis
- Occlusal contact and clearance analysis
- QC finding support
- Remake and defect risk
- Capacity, delivery, and material forecasts
- Communication drafting
- Case prioritization

The architectural goal is trusted assistance. AI outputs must be explainable enough for their use, linked to evidence, versioned by model and configuration, monitored for quality, and subject to human review where consequences are clinical, financial, or operational.

AI is a platform capability, not a shortcut around domain architecture, authorization, audit, or data governance.

## End-state experience

A future case should be able to move through NorthStar as one continuous record:

1. A practice submits a digital case through its scanner or portal.
2. NorthStar validates the submission, stores the files, and identifies missing information.
3. The laboratory reviews clinical context and communicates structured clarifications.
4. Mesh and imaging services prepare the data for visualization and CAD.
5. Approved CAD artifacts flow into manufacturing planning.
6. Production, QC, shipping, and billing remain synchronized.
7. Every important decision, artifact, transition, and outcome remains traceable.
8. AI assists users with evidence-based recommendations while humans retain authority.

## Architectural goals

### One operational truth

A case has one authoritative identity and lifecycle across intake, production, QC, shipping, billing, CAD, manufacturing, and analysis.

### Durable provenance

Original files, derived artifacts, measurements, AI findings, human corrections, approvals, and production outputs are versioned and attributable.

### Modular growth

The ERP remains a coherent transactional core. Specialized workloads expand through stable module and service boundaries.

### Enterprise tenancy

The platform supports multiple laboratories, locations, practices, users, and roles without data leakage or ambiguous ownership.

### Clinical responsibility

Clinical tools present evidence, limitations, and review state. They do not disguise uncertainty or overstate authority.

### Operational resilience

Core ERP workflows remain available when optional integrations, AI models, or compute services are degraded.

### Provider independence

Scanner, cloud, payment, courier, CAD, manufacturing, and model providers are replaceable through interfaces and versioned contracts.

### Backward compatibility

Growth does not strand existing customers or silently corrupt established workflows. Changes use migrations, compatibility windows, and clear release policy.

### Measurable quality

The platform measures data completeness, turnaround, defects, first-pass yield, remakes, delivery, collections, service reliability, and model performance.

## Product principles

- Build for the real laboratory workflow, not a generic task manager.
- Reduce re-entry and lost context.
- Make the next required action visible.
- Keep clinically meaningful evidence attached to the case.
- Preserve human accountability.
- Improve quality before increasing automation.
- Prefer reliable integration over superficial breadth.
- Treat security, privacy, and recovery as part of usability.
- Expose complexity only where trained users need control.

## What NorthStar is not

NorthStar is not intended to become:

- A collection of disconnected feature screens
- A vendor-locked file repository
- A black-box clinical decision maker
- A CAD engine with no operational context
- A manufacturing controller with no quality traceability
- An analytics layer that contradicts the transactional system of record

## Long-term outcome

CADence NorthStar should allow a laboratory to operate its business, receive and understand digital cases, coordinate clinicians and technicians, manage design and manufacturing, control quality and delivery, and learn from outcomes through one governed platform.

The permanent measure of success is not the number of modules. It is whether the platform makes restorative work more precise, more reliable, more explainable, and easier to coordinate at scale.
