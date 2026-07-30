# Community Preview 1 Beta — Release Candidate

## Status

Community Preview 1 Beta (CP1 Beta) has been achieved through completion of Sprint 9: Infrastructure Core — Durable Persistence.

## Included capability

CP1 Beta contains the verified ERP workflows completed through Sprint 8 with production persistence provided by PostgreSQL and the `ObjectStorage` abstraction.

Included operational domains:

- Authenticated application access
- Practice and Doctor Management
- Patient and Case Intake
- Production Workflow
- Quality Control
- Shipping & Logistics
- Billing & Financial
- PostgreSQL-backed dashboard metrics
- Durable case and QC attachments
- Immutable audit history

## Compatibility

The user experience and verified business rules remain functionally consistent with the end of Sprint 8. Existing APIs continue accepting the established payloads, including backward-compatible base64 attachment payloads, while production handlers persist binary data through `ObjectStorage`.

## Validation baseline

The Sprint 9 closeout validation requires:

- Reproducible installation
- Strict TypeScript validation
- Production build
- PostgreSQL migration application, rollback, and reapplication
- Repository and object-storage integration tests
- Relationship, audit, dashboard, and restart-persistence verification
- Runtime Validation against PostgreSQL-backed services
- Complete Sprints 3–8 Playwright regression coverage

## Rollback considerations

Database rollback scripts are destructive and are intended for controlled validation and emergency schema reversal. A production rollback requires restoring both the pre-migration PostgreSQL backup and the corresponding object backup. Imported operational records cannot be recovered from schema rollback scripts alone.

## Deferred beyond CP1 Beta

- Production identity-provider integration and secure server sessions
- Server-side authorization policy expansion
- Managed cloud object-storage credentials and deployment
- Encryption-key management, malware scanning, and retention automation
- Durable generation of invoice PDFs and shipping documents when those existing domains begin producing binary artifacts
- Read replicas, partitioning, pooling proxies, and tenant-specific data residency
- Scanner, CAD-processing, and AI-service integrations

No Sprint 10 functionality is included in CP1 Beta.
