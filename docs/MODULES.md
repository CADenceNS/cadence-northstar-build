# CADence NorthStar Module Catalog

## Purpose

This catalog defines the purpose, ownership, public interfaces, dependencies, and future direction of every major CADence NorthStar subsystem. Modules are logical boundaries first. A module does not become a separately deployed service unless the extraction criteria in `MASTER_ARCHITECTURE.md` are met.

## Module contract rules

- Each module owns its validation, lifecycle state, and durable records.
- Other modules use public application interfaces, APIs, or versioned events.
- Direct cross-module table writes are prohibited.
- Public interfaces are typed and backward compatible.
- Every authenticated mutation emits one immutable audit event unless one external action intentionally produces multiple documented domain events.
- Tenant and authorization context accompany every protected operation.

# Current modules

## Authentication

**Purpose**  
Establish user identity and authenticated application sessions.

**Responsibilities**

- Login and logout
- User status and identity lookup
- Session creation, renewal, and termination
- Future federation and multifactor authentication
- Authentication audit events

**Public interfaces**

- Login/logout endpoints
- Session/user query
- `UserRepository`
- Future `IdentityProvider` and `SessionStore` contracts

**Dependencies**

- User repository
- Audit repository
- Future external identity provider and secure session store

**Future expansion**

- OIDC/SAML
- Multifactor authentication
- Device and session management
- Service identities
- Tenant and location membership

## Practice

**Purpose**  
Represent dental practices as customer accounts and billing/operational owners.

**Responsibilities**

- Practice profile and account number
- Office manager and contact information
- Scanner and submission preferences
- Tax-exempt status
- Communication history
- Practice lifecycle and soft deletion

**Public interfaces**

- Practice CRUD and search APIs
- Practice application commands and queries
- `PracticeRepository`
- Future `PracticeCreated` and `PracticeUpdated` events

**Dependencies**

- Authentication/authorization
- Audit
- Billing for account-level financial relationships

**Future expansion**

- Multiple locations
- Contracts and price schedules
- Credit terms
- Portal configuration
- Scanner connections

## Doctor

**Purpose**  
Represent prescribing clinicians associated with practices.

**Responsibilities**

- Doctor identity and contact information
- Practice association
- Specialty and status
- Preferences and communications
- Relationship validation

**Public interfaces**

- Doctor CRUD and search APIs
- Doctor application commands and queries
- `DoctorRepository`

**Dependencies**

- Practice
- Authentication/authorization
- Audit

**Future expansion**

- Multiple practice affiliations
- Structured restoration preferences
- Licensure metadata
- Portal identity linkage
- Performance and remake analytics

## Patient

**Purpose**  
Represent the minimum patient information needed to coordinate laboratory cases.

**Responsibilities**

- Patient reference and demographics
- Practice and Doctor relationships
- Status and notes
- Privacy-aware data handling

**Public interfaces**

- Patient CRUD and search APIs
- Patient application commands and queries
- `PatientRepository`

**Dependencies**

- Practice
- Doctor
- Authentication/authorization
- Audit

**Future expansion**

- Consent and communication preferences
- Patient Portal identity linkage
- Data minimization and retention policy
- External patient identifiers

## Case Intake

**Purpose**  
Create and manage the laboratory case as the primary operational aggregate.

**Responsibilities**

- Case numbering
- Practice, Doctor, and Patient linkage
- Restoration, material, shade, arch, and tooth data
- Turnaround and due-date calculation
- Rush priority
- Prescription notes
- Attachments and object ownership
- Case lifecycle state

**Public interfaces**

- Case CRUD, search, and attachment APIs
- Case commands for status synchronization
- `CaseRepository`
- `ObjectStorage`
- Future case lifecycle events

**Dependencies**

- Practice
- Doctor
- Patient
- Object Storage
- Audit

**Future expansion**

- Structured prescriptions
- Implant and scan metadata
- Versioned submissions
- Case planning
- Scanner Gateway ingestion
- Doctor clarification workflows

## Production Workflow

**Purpose**  
Control laboratory routing, assignment, departmental status, SLA, and completion.

**Responsibilities**

- Route A/B/C definitions
- Work-item creation
- Department transitions
- Technician assignment
- SLA calculation
- Workload and overdue metrics
- Production history

**Public interfaces**

- Work-item and workload APIs
- Production transition commands
- `ProductionRepository`
- Future production events

**Dependencies**

- Case Intake
- Authentication/authorization
- Audit

**Future expansion**

- Configurable workflows
- Barcode scanning
- Capacity planning
- Work centers and equipment
- Material and lot traceability
- Manufacturing job orchestration

## Quality Control

**Purpose**  
Provide configurable, signed, auditable inspection of completed restorative work.

**Responsibilities**

- Restoration-specific templates
- Checklist execution
- Pass, Rework, Hold, Remake, and Doctor Clarification outcomes
- Defect categories and trends
- Inspector sign-off
- QC photos
- Case readiness synchronization

**Public interfaces**

- QC template, inspection, photo, history, and metric APIs
- `QCRepository`
- `ObjectStorage`
- Case status command

**Dependencies**

- Case Intake
- Object Storage
- Authentication/authorization
- Audit

**Future expansion**

- Template versioning
- Sampling plans
- Measurement instruments
- Automated image/mesh findings
- Supplier and technician quality analytics
- Corrective-action workflows

## Shipping & Logistics

**Purpose**  
Coordinate packing, pickup, shipment, tracking, delivery, and shipment history.

**Responsibilities**

- Ready-to-Ship, Awaiting Pickup, Shipped, and Delivered queues
- Packing checklists
- Partial and multi-case shipments
- Courier and tracking data
- Barcode-ready identifiers
- Delivery confirmation
- Case completion synchronization

**Public interfaces**

- Ready-case, shipment, transition, and metric APIs
- `ShippingRepository`
- Case status command
- Billing delivery notification

**Dependencies**

- Case Intake
- Quality Control
- Billing
- Authentication/authorization
- Audit

**Future expansion**

- Courier APIs
- Label and manifest generation
- Pickup scheduling
- Proof of delivery
- Multi-location dispatch
- Exception and loss workflows

## Billing & Financial

**Purpose**  
Convert delivered work into invoices, payments, receivables, statements, and financial metrics.

**Responsibilities**

- Automatic invoice generation
- Multi-case invoices
- Lines, taxes, discounts, fees, credits, and terms
- Payment recording
- AR aging
- Monthly statements
- Financial dashboard metrics

**Public interfaces**

- Invoice, adjustment, payment, aging, statement, and metric APIs
- `FinancialRepository`
- Shipment-delivered application interface

**Dependencies**

- Practice
- Case Intake
- Shipping
- Authentication/authorization
- Audit

**Future expansion**

- Price schedules and contracts
- Payment processors
- General-ledger exports
- Reconciliation
- Durable PDFs
- Credits, remakes, and vendor chargebacks

## Infrastructure Core

**Purpose**  
Provide durable, secure, provider-neutral technical foundations without embedding infrastructure concerns in business modules.

**Responsibilities**

- PostgreSQL registry and repositories
- Transactions
- Migrations and rollback
- Tenant context
- Object storage
- Immutable audit repository
- Legacy snapshot migration
- Runtime composition

**Public interfaces**

- Repository interfaces and registry
- `ObjectStorage`
- `AuditRepository`
- Migration and provider contracts

**Dependencies**

- PostgreSQL
- Future cloud storage, identity, queue, secrets, and observability providers

**Future expansion**

- Transactional outbox
- Message broker
- Cloud object storage
- Managed secrets and keys
- Read models and warehouse feeds
- Regional deployment

# Future modules

## Scanner Gateway

**Purpose**  
Securely ingest digital cases and files from scanner ecosystems and laboratory portals.

**Responsibilities**

- Provider adapters
- Account mapping
- Webhook/polling ingestion
- File validation and quarantine
- Idempotency and retry
- Submission normalization
- Case Intake handoff

**Public interfaces**

- `ScannerProviderAdapter`
- Ingestion API
- Versioned `ScanSubmissionReceived` event
- ObjectStorage writes

**Dependencies**

- Authentication/tenant mapping
- Object Storage
- Case Intake
- Background jobs
- Audit and observability

**Future expansion**

- iTero, 3Shape, Medit, DS Core, Shining 3D, Carestream, Planmeca, and other adapters
- Connection health and reconciliation
- Automatic file classification

## Clinical Communications

**Purpose**  
Manage structured laboratory–practice communication tied to cases and decisions.

**Responsibilities**

- Messages, questions, clarifications, and approvals
- Who/What/When/Where/Why context
- Attachments
- Delivery status
- Communication timeline and audit

**Public interfaces**

- Conversation and clarification APIs
- Notification provider contract
- Case-linked communication events

**Dependencies**

- Case Intake
- Practice and Doctor
- Authentication/authorization
- Object Storage
- Audit

**Future expansion**

- Email/SMS/push
- Templates
- SLA and escalation
- AI-assisted drafting with human approval

## Doctor Portal

**Purpose**  
Provide secure, practice-scoped submission, tracking, communication, and financial visibility.

**Responsibilities**

- Case submission
- File upload
- Status and delivery visibility
- Clarifications and approvals
- Statements and invoices according to role

**Public interfaces**

- Portal-specific APIs or BFF
- Shared versioned contracts

**Dependencies**

- Identity and authorization
- Practice, Doctor, Patient, Case, Communications, Shipping, Billing

**Future expansion**

- Scanner connection management
- Preferences
- Digital approvals
- Analytics and account administration

## Patient Portal

**Purpose**  
Provide narrowly authorized patient communication and education where legally and operationally appropriate.

**Responsibilities**

- Consent and identity verification
- Approved status communication
- Education and instructions
- Secure messaging where enabled

**Public interfaces**

- Patient-scoped APIs
- Consent and notification contracts

**Dependencies**

- Identity
- Patient
- Doctor/Practice authorization policies
- Clinical Communications

**Future expansion**

- Appointment-linked workflows
- Digital consent
- Outcome feedback

## Mesh Engine

**Purpose**  
Process and analyze 3D dental meshes outside the transactional API runtime.

**Responsibilities**

- STL/OBJ/PLY parsing
- Validation and normalization
- Conversion
- Mesh statistics
- Repair
- Derived artifact versioning

**Public interfaces**

- Asynchronous job API
- `MeshJobRequested`, `MeshJobCompleted`, and `MeshJobFailed` events
- ObjectStorage inputs and outputs

**Dependencies**

- Object Storage
- Job platform
- Case Intake
- Observability

**Future expansion**

- Segmentation
- Alignment
- Difference maps
- CAD preparation
- GPU/native compute

## STL Viewer

**Purpose**  
Provide safe browser visualization of dental meshes and analysis overlays.

**Responsibilities**

- Progressive mesh loading
- Camera and orientation controls
- Measurement tools
- Arch and object visibility
- Annotation and overlay rendering

**Public interfaces**

- Viewer component package
- Signed object-access API
- Annotation contracts

**Dependencies**

- Mesh Engine
- Object Storage
- Case Intake

**Future expansion**

- Occlusal views
- Cross-case comparison
- QC and preparation overlays
- Collaborative annotations

## DICOM Viewer

**Purpose**  
Render and navigate DICOM/CBCT data with strict privacy and performance controls.

**Responsibilities**

- Study/series metadata
- Slice viewing and multiplanar reconstruction
- Window/level controls
- Secure streaming
- Case linkage

**Public interfaces**

- Viewer component
- DICOM metadata and signed-frame APIs

**Dependencies**

- DICOM processing service
- Object Storage
- Identity and authorization

**Future expansion**

- Implant planning overlays
- Mesh/DICOM registration
- Measurements and annotations

## Margin Detection

**Purpose**  
Assist trained users by identifying likely preparation margins and uncertainty.

**Responsibilities**

- Versioned inference
- Candidate margin geometry
- Confidence and uncertainty
- Human correction and approval
- Provenance and evaluation records

**Public interfaces**

- Asynchronous analysis API
- Versioned result schema
- Human-review commands

**Dependencies**

- Mesh Engine
- Clinical AI platform
- Object Storage
- Case Intake

**Future expansion**

- Active learning from approved corrections
- Material/restoration-specific models

## Preparation Analysis

**Purpose**  
Assess preparation geometry against configurable restorative guidelines.

**Responsibilities**

- Reduction, taper, clearance, undercut, and finish-line analysis
- Configurable material rules
- Explainable findings
- Human review

**Public interfaces**

- Analysis job and result contracts
- Rule-set version interfaces

**Dependencies**

- Mesh Engine
- Case and restoration metadata
- Clinical AI/rule engine

**Future expansion**

- Doctor-specific feedback
- Longitudinal quality trends
- Chairside integrations

## Occlusion Analysis

**Purpose**  
Analyze interarch relationships, contacts, clearance, and potential interferences.

**Responsibilities**

- Arch alignment inputs
- Contact and clearance maps
- Threshold configuration
- Explainable findings and overlays

**Public interfaces**

- Analysis job API
- Occlusion result and visualization contracts

**Dependencies**

- Mesh Engine
- Case Intake
- STL Viewer

**Future expansion**

- Dynamic articulation
- Virtual articulator adapters
- Restoration adjustment recommendations

## Manufacturing Intelligence

**Purpose**  
Optimize production capacity, material use, equipment routing, quality, and delivery performance.

**Responsibilities**

- Equipment and work-center models
- Material compatibility
- Capacity and queue projections
- Nesting/job recommendations
- Telemetry and failure intelligence

**Public interfaces**

- Planning APIs
- Equipment adapter contracts
- Manufacturing events and projections

**Dependencies**

- Production Workflow
- Inventory/material data
- CAD outputs
- Equipment telemetry
- Analytics platform

**Future expansion**

- Predictive maintenance
- Automated scheduling
- Cost and yield optimization
- Multi-location balancing

## AI Clinical Assistant

**Purpose**  
Provide explainable, human-supervised assistance across case intake, clinical communication, QC, and analysis.

**Responsibilities**

- Context assembly with authorization
- Model and prompt versioning
- Evidence and provenance
- Confidence and limitations
- Human approval
- Safety policy and evaluation

**Public interfaces**

- Versioned assistant request/result APIs
- Tool and evidence contracts
- Feedback and evaluation records

**Dependencies**

- Clinical modules
- AI model gateway
- Audit
- Authorization
- Object Storage
- Observability

**Future expansion**

- Case completeness checks
- Clarification recommendations
- QC assistance
- Remake-risk insights
- Manufacturing and delivery forecasting

## Cross-module future contracts

The platform should standardize these contracts before major expansion:

- Tenant and location context
- Authenticated actor context
- Object reference
- Audit event
- Domain event envelope
- Idempotency key
- Job status and retry metadata
- Clinical finding with provenance and human-review state
- Versioned API error
- Pagination and filtering

## Module review policy

Every future sprint must identify:

- Modules changed
- Public contracts changed
- Dependencies introduced
- Data owned
- Audit events emitted
- Migration and rollback impact
- Whether extraction criteria are newly met
