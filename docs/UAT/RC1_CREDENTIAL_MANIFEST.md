# NorthStar RC1 — Development/UAT Credential Manifest

**Development/UAT only — prohibited in Production.**

All personas use the password configured in `NORTHSTAR_UAT_PASSWORD`. The release custodian communicates that value separately from source control.

| Persona | Email | Tenant | Current security mapping | Expected landing | Key allowed actions | Simulation limitation |
|---|---|---|---|---|---|---|
| Platform Owner simulation | platform.owner@northstar-uat.example | Keramos | system-administrator | Laboratory Status | ECC, UAT, intake administration | Permanent commercial Platform Owner role is deferred to Sprint 13B |
| Tenant Owner | tenant.owner@keramos-uat.example | Keramos | laboratory-administrator | Laboratory Status | tenant administration, ECC, UAT, operational modules | Permanent Tenant Owner commercial controls are deferred |
| Tenant Administrator | tenant.admin@keramos-uat.example | Keramos | laboratory-administrator | Laboratory Status | administration, ECC, UAT | Uses existing CP2 administrator boundary |
| Customer Service | customer.service@keramos-uat.example | Keramos | customer-service | Laboratory Status | intake, cases, communications, UAT | No commercial control-plane access |
| CAD Designer | cad.designer@keramos-uat.example | Keramos | cad-technician | Production Workflow | cases, CAD/production work, UAT | CAD tools remain the current implemented shell |
| QC Technician | qc.technician@keramos-uat.example | Keramos | qc-technician | Quality Control | production review, QC, UAT | Advanced quality intelligence is deferred |
| Production Technician | production.technician@keramos-uat.example | Keramos | production-technician | Production Workflow | cases, production, UAT | Workflow Engine is not implemented |
| Shipping | shipping@keramos-uat.example | Keramos | shipping | Shipping & Logistics | cases, shipping, UAT | External carrier adapters are deferred |
| Accounting | accounting@keramos-uat.example | Keramos | billing | Billing & Financial Engine | billing, invoices, UAT | General Ledger is deferred |
| Sales | sales@keramos-uat.example | Keramos | sales | Laboratory Status | Practices, Doctors, UAT | Sales pipeline expansion is deferred |
| Doctor | doctor@keramos-uat.example | Keramos | doctor | Case Intake | scoped patients, cases, UAT | Full white-label portal is deferred |
| Office Staff | office.staff@keramos-uat.example | Keramos | doctor with delegated Practice scope | Case Intake | scoped patients, cases, UAT | Dedicated office-staff role is deferred |
| Sample Laboratory A Owner | owner@sample-lab-a-uat.example | Sample Laboratory A | laboratory-administrator | Laboratory Status | isolated dashboard and UAT | Tenant-native operational CRUD beyond the isolation preview is deferred |

The original CP2 administrator remains available only where the approved Development/UAT bootstrap process provisions it.

Never commit a live Production password, reset token, session cookie or provider credential.