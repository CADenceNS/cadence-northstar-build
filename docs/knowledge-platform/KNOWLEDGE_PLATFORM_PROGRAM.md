# CADence Knowledge Platform Program

## Status

Independent engineering initiative. Governance and ownership only. No Morphology, clinical-rule, material-intelligence, restoration-template, manufacturing-profile, or AI implementation is authorized by this document.

## Vision

The Knowledge Platform is CADence’s governed source of proprietary dental knowledge. It will make approved clinical, morphological, material, quality, restoration, manufacturer, and manufacturing knowledge available to authorized products through immutable, versioned, explainable contracts.

It is independent of both NorthStar ERP and Design Studio.

## Product hierarchy

```text
CADence Product Portfolio
├─ NorthStar ERP
│  └─ laboratory operations and business system of record
├─ Design Studio
│  └─ design projects, scenes, tools, validation and manufacturing handoff
└─ Knowledge Platform
   └─ governed proprietary knowledge, rules, templates and profiles
```

## Responsibilities

The Knowledge Platform may eventually own:

- Proprietary Morphology Library
- Clinical Rule Engine
- QC Knowledge Base
- Material Intelligence
- Restoration Templates
- Manufacturer Libraries
- Manufacturing Profiles
- Knowledge provenance and evidence
- Approval, publishing, deprecation, and supersession
- Licensing and entitlement metadata
- Compatibility matrices
- Knowledge distribution and caching contracts
- Knowledge usage telemetry without exposing tenant clinical data

## Boundaries

### Knowledge Platform owns

- canonical knowledge identity;
- semantic version and lifecycle;
- source provenance and evidence;
- clinical/technical approval state;
- effective and retirement dates;
- compatibility and applicability;
- licensing and distribution restrictions;
- rule/template/profile payloads;
- validation suites for published knowledge.

### Knowledge Platform does not own

- NorthStar cases, prescriptions, users, workflows, billing, communications, or operational QC records;
- Design Studio projects, scenes, selections, tool commands, geometry edits, reviews, or exports;
- patient-specific diagnosis or autonomous clinical authority;
- machine execution or production release.

## Core domain concepts

- Knowledge Package
- Knowledge Asset
- Morphology Asset
- Clinical Rule
- QC Rule
- Material Profile
- Restoration Template
- Manufacturer Reference
- Manufacturing Profile
- Evidence Source
- Approval Record
- Compatibility Declaration
- Entitlement Policy
- Publication Channel
- Deprecation/Supersession Record

## Knowledge lifecycle

`Draft → Technical Review → Clinical Review where applicable → Validation → Approved → Published → Deprecated → Retired`

Published versions are immutable. Corrections create a new version and explicit supersession relationship.

## Provenance requirements

Every published asset records:

- unique identifier and semantic version;
- author/maintainer;
- source references and evidence classification;
- intended use and prohibited use;
- applicable restoration, material, manufacturer, and workflow contexts;
- validation fixtures and expected results;
- approval identities and timestamps;
- effective, deprecation, and retirement dates;
- licensing and distribution terms;
- known limitations and uncertainty.

## Integration with Design Studio

Design Studio consumes knowledge through a versioned Library/Knowledge Gateway.

Required behavior:

- request includes tenant, actor, entitlement, product version, and intended use;
- response returns immutable asset/version identity, compatibility, provenance, and payload;
- Design Studio projects pin exact versions;
- cached knowledge retains version and expiration metadata;
- unavailable or revoked knowledge fails safely;
- knowledge does not directly mutate geometry or approve designs;
- tool execution records the knowledge versions used.

## Integration with NorthStar

NorthStar may consume approved knowledge for:

- structured clinical and product guidance;
- QC reason codes and knowledge references;
- material/restoration compatibility display;
- configuration assistance;
- future workflow recommendations.

NorthStar remains operational authority. Knowledge responses do not bypass authorization, change invoices, alter prescriptions, or advance workflow automatically.

## Clinical Rule Engine principles

- Rules are versioned, deterministic where possible, testable, and explainable.
- Inputs and outputs use validated schemas and declared units.
- Rules declare applicability, exclusions, severity, confidence, and human-review requirements.
- Rule results are recommendations or evidence unless an approved policy explicitly grants blocking authority.
- Patient-specific diagnosis and autonomous treatment decisions are prohibited.

## Morphology governance

Morphology is proprietary knowledge, not merely a file collection.

Before implementation, the program must define:

- legal and licensing provenance;
- tooth/restoration taxonomy;
- coordinate, scale, landmarks, and metadata standards;
- quality and clinical review;
- versioning and compatibility;
- validation fixtures;
- tenant/product entitlements;
- distribution and anti-exfiltration controls;
- deprecation and correction process.

No Morphology implementation may begin until these controls are approved.

## Security and commercial controls

- Knowledge packages are not stored in NorthStar or Design Studio domain tables.
- Distribution requires product and tenant entitlement.
- Sensitive proprietary assets may use encrypted delivery and controlled local caching.
- Support access and asset export are audited.
- Customer clinical data is not incorporated into proprietary knowledge without explicit approved governance and de-identification.
- Cross-tenant data is never used for knowledge improvement by default.

## Validation model

Each knowledge type requires:

- schema validation;
- deterministic fixture tests;
- compatibility tests;
- version/supersession tests;
- authorization and entitlement tests;
- provenance completeness;
- clinical/technical review evidence where applicable;
- downstream contract tests with NorthStar and Design Studio.

## Initial roadmap

### Completed

- Independent program registered.
- Ownership boundaries documented.
- Morphology implementation blocked pending governance.

### Next planning milestone

- Knowledge taxonomy and package model.
- Versioning and publishing ADR.
- Provenance/evidence policy.
- Entitlement and distribution architecture.
- Initial synthetic/licensed fixture strategy.
- NorthStar and Design Studio gateway contracts.

### Future

- QC Knowledge Base foundation.
- Material Intelligence foundation.
- Restoration Template foundation.
- Manufacturer and manufacturing profiles.
- Proprietary Morphology Library.
- Clinical Rule Engine.
- Governed analytics and improvement lifecycle.

## Development lifecycle

`Knowledge Research → Draft → Review → Validation → Approval → Versioned Publication → Product Integration → Monitoring → Deprecation/Retirement`

## Governance rule

The Knowledge Platform must maintain its own Architecture Bible, Module Registry, Roadmap, Technical Debt Register, Engineering Dashboard, ADR index, release manifests, and validation evidence before runtime development begins.