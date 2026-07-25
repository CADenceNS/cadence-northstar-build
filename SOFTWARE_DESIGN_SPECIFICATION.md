# CADence NorthStar Software Design Specification

## 1. Architecture Overview

NorthStar will use a TypeScript monorepo with clearly separated web, API, shared contracts, database, and documentation layers.

Recommended structure:

```text
apps/
  web/
  api/
packages/
  shared/
  database/
  config/
docs/
  adr/
```

The production architecture should use:

- React and TypeScript for the web application
- Node.js and TypeScript for the API
- PostgreSQL as the system of record
- Prisma ORM for schema, migrations, and typed database access
- Zod for runtime validation
- Secure cookie-based sessions
- Object storage for large case files
- Structured JSON logging
- Docker for repeatable local development
- GitHub Actions for automated validation

## 2. Design Principles

1. Server-side persistence is authoritative.
2. Tenant and location boundaries are explicit.
3. Business rules belong in domain services, not UI components.
4. API inputs are validated at the boundary.
5. Shared types do not replace runtime validation.
6. Critical workflow actions are transactional and audited.
7. Records with historical relationships are archived, not hard-deleted.
8. Files are stored outside the relational database; metadata remains in PostgreSQL.
9. Security defaults to least privilege.
10. Every production change is reversible through migrations and documented recovery procedures.

## 3. Logical Layers

### Web Application

Responsibilities:

- Authentication screens
- Role-aware navigation
- Forms and tables
- Case workflow screens
- Dashboard and reports
- File upload user experience
- Accessible validation and error presentation

The web application must not contain authoritative due-date, pricing, permission, or workflow logic.

### API

Responsibilities:

- Authentication and authorization
- Input validation
- Business rule execution
- Transactions
- Audit events
- Data access
- File metadata and signed upload/download workflows
- Integration endpoints
- Health and readiness endpoints

### Domain Services

Initial services:

- IdentityService
- OrganizationService
- PracticeService
- DoctorService
- CaseService
- TurnaroundService
- WorkflowService
- QualityControlService
- ShippingService
- BillingService
- InventoryService
- AuditService
- FileService
- ReportingService

### Data Layer

Prisma repositories or service-level data access must enforce organization scoping. Direct database access from route handlers should be avoided once domain services are established.

## 4. Initial Data Model

Core entities:

- Organization
- Location
- User
- Role
- Permission
- UserRole
- Session
- Practice
- PracticeLocation
- Doctor
- DoctorPractice
- Contact
- ScannerConnection
- DoctorPreference
- LaboratoryCase
- CaseItem
- CaseFile
- CaseStatusEvent
- ProductionTask
- QualityControlReview
- Shipment
- PickupRequest
- PriceList
- PriceItem
- Invoice
- InvoiceLine
- Payment
- Vendor
- PurchaseOrder
- PurchaseOrderLine
- InventoryItem
- InventoryTransaction
- Communication
- AuditEvent
- HolidayCalendar
- TurnaroundRule

All tenant-owned tables require an `organizationId`. Location-sensitive records should also include `locationId`.

## 5. Authentication and Authorization

- Passwords must be hashed with a modern password hashing algorithm.
- Production credentials must never be committed.
- Sessions must be revocable and expire.
- Authentication cookies must be HTTP-only, secure in production, and use an appropriate SameSite policy.
- Permission checks must occur on the server.
- Administrative actions, access changes, exports, imports, billing changes, and workflow overrides must be audited.
- Portal users must only access their authorized practice records.

## 6. Case and Workflow Design

A case contains one or more case items. Each case item represents a restoration, appliance, arch, or related deliverable.

Workflow is represented by:

- Current case status
- Current department
- Route definition
- Required and completed production tasks
- Immutable status events
- Blocking issues
- QC approval state
- Shipment eligibility

Workflow transitions must be validated server-side. A transition should fail when prerequisites are missing.

## 7. Turnaround Calculation

Turnaround rules are configurable by organization, location, category, product, intake type, and rush level.

The calculation service must:

1. Start from the accepted received date.
2. Apply the correct in-lab business-day rule.
3. Skip weekends.
4. Skip configured holidays and closures.
5. Add shipping days separately where applicable.
6. retain the original calculated date and record approved overrides.
7. Explain which rule produced the date.

## 8. File Architecture

Case files may include large dental scan and imaging formats. The platform should use direct-to-object-storage uploads using signed URLs.

Database metadata should include:

- Case ID
- File type
- Clinical purpose
- Arch or tooth reference
- Original file name
- Storage key
- MIME type
- Byte size
- Checksum
- Uploaded by
- Uploaded at
- Version
- Active / superseded state

Protected files must not be publicly addressable.

## 9. API Conventions

- Base path: `/api/v1`
- JSON request and response bodies
- Consistent error envelope
- Cursor pagination for large collections
- Explicit filtering and sorting
- Idempotency protection for sensitive create operations
- Request correlation ID
- Versioned contracts
- OpenAPI documentation

Example error shape:

```json
{
  "error": {
    "code": "CASE_TRANSITION_BLOCKED",
    "message": "QC approval is required before shipping.",
    "details": [],
    "requestId": "..."
  }
}
```

## 10. Observability

- Structured logs
- Request ID propagation
- Error reporting
- Health endpoint
- Readiness endpoint with database check
- Audit event viewer
- Metrics for latency, failures, job queues, storage, and database health

No protected patient information should be included in general application logs.

## 11. Testing Strategy

- Unit tests for business rules
- Integration tests for API and database behavior
- Authorization tests for every protected resource
- Migration validation
- End-to-end tests for critical workflows
- Backup and restore test
- Build and type-check gates on every pull request

Critical end-to-end paths:

1. Sign in
2. Create practice and doctor
3. Create case
4. Calculate due date
5. Route through production
6. Complete QC
7. Create shipment
8. Create invoice
9. Verify audit history

## 12. Deployment

Development:

- Docker Compose
- PostgreSQL container
- API and web local processes
- Seeded development organization

Production:

- Managed PostgreSQL
- Managed object storage
- HTTPS
- Secret manager
- Automated deployment
- Automated migrations with review
- Encrypted backups
- Monitoring and alerting

## 13. v0.4.0 Technical Scope

- Add database package and Prisma
- Add PostgreSQL Docker service
- Add environment examples and validation
- Add User, Organization, Role, Session, Practice, Doctor, Case, and AuditEvent models
- Add initial migration and seed script
- Replace hard-coded login with secure authentication
- Add server-side authorization foundation
- Add validation and centralized errors
- Add logging
- Add API tests
- Add working GitHub Actions validation
