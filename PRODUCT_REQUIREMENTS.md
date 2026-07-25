# CADence NorthStar Product Requirements Document

## 1. Product Purpose

CADence NorthStar is the operating platform for a modern dental laboratory. Its first implementation is for Keramos Dental Laboratory LLC, while the architecture should support future multi-location and multi-tenant use without requiring a redesign.

The platform must connect customer relationship management, case intake, digital files, production, quality control, shipping, billing, purchasing, inventory, analytics, and client communication in one traceable system.

## 2. Product Goals

1. Create one authoritative record for every practice, doctor, case, file, workflow event, invoice, shipment, and communication.
2. Reduce remakes, missed due dates, incomplete submissions, and communication failures.
3. Make laboratory workload, risk, profitability, turnaround, and quality visible in real time.
4. Support pure digital, hybrid, and manual production routes.
5. Provide secure role-based access for laboratory staff and future client portal users.
6. Preserve a complete audit history for critical changes.

## 3. Primary Users

- Administrator
- Executive / Owner
- Sales and Business Development
- Customer Service
- Receiving
- Model Department
- CAD / Digitization
- Milling / Printing
- Ceramics
- Quality Control
- Shipping
- Billing / Accounts Receivable
- Purchasing / Accounts Payable
- Doctor / Practice Portal User

## 4. Core Modules

### 4.1 Organization and Security

The system must support organizations, locations, users, roles, permissions, secure authentication, session management, account activation, password reset, and audit logging.

### 4.2 Practice and Doctor CRM

The system must maintain separate records for practices and doctors, including associates, office managers, addresses, phone numbers, email addresses, scanner connections, preferences, tax-exempt status, certificates, account numbers, status, notes, and communication history.

### 4.3 Case Intake

A case record must support:

- Automatic case number
- Practice and doctor
- Patient reference without unnecessary protected health information
- Department and production route
- Restoration category and subtype
- Tooth or arch selection
- Material
- Shade and stump shade
- Implant system and component details
- Intake type
- Received date
- Due date calculated from laboratory rules
- Rush status and fees
- Notes, prescription, images, scans, and supporting files
- Validation of required records before acceptance

### 4.4 Digital File Management

The system must classify and retain files such as STL, OBJ, PLY, DICOM / CBCT references, X-rays, photographs, prescriptions, PDFs, and manufacturing outputs. Files must be associated with a case and labeled by purpose, arch, scan stage, source, and version.

### 4.5 Production Workflow

The platform must support configurable routes.

Route A — Pure Digital:

1. Receiving
2. CAD
3. Mill / Print
4. Ceramics
5. QC
6. Shipping

Route B — Hybrid:

1. Receiving
2. Model
3. Digitization / CAD
4. Mill / Print
5. Ceramics
6. QC
7. Shipping

Route C — Manual:

1. Receiving
2. Model
3. Ceramics
4. QC
5. Shipping

Each movement must record time, user, department, action, notes, and status.

### 4.6 Quality Control

QC must support design review, material verification, fit checks, contact checks, occlusion, anatomy, margins, shade, surface, implant component verification, bridge-specific checks, remake classification, corrective action, approval, rejection, and sign-off.

A case may not advance to shipping until required QC gates are approved.

### 4.7 Shipping and Logistics

The system must support inbound and outbound scanning, pickups, courier details, labels, manifests, tracking numbers, shipping history, delivery status, special instructions, and closure of shipment records.

### 4.8 Billing and Finance

The system must support price lists, case charges, taxes, fees, discounts, invoices, statements, credits, remakes, payments, aging, dunning, vendor bills, purchase orders, and profitability reporting.

### 4.9 Purchasing and Inventory

Inventory must support product IDs, implant components, materials, vendors, quantities on hand, reorder thresholds, requests, approvals, purchase orders, receiving, fulfillment, and case allocation.

### 4.10 Analytics

The dashboard and reports must provide daily, weekly, monthly, quarterly, and annual views, including:

- Cases received and completed
- Due today and overdue cases
- Department workload
- Turnaround performance
- Revenue and case volume
- Product and material mix
- Doctor and practice performance
- Remake percentage
- Intake type
- Route distribution
- Current-versus-previous comparisons
- Top clients
- Profitability indicators

### 4.11 Client Portal

Future portal capabilities must include secure login, case submission, file upload, status tracking, messages, invoices, statements, pickup requests, preference forms, and downloadable documents.

## 5. Business Rules

- Crown and bridge baseline production time: 10 business days.
- Implant, removable, orthodontic, and related complex categories: 14 business days unless overridden by an approved rule.
- Shipping time may be calculated separately from in-lab production time.
- Due-date calculation must skip weekends and configurable holidays.
- Required fields and files must vary by case type.
- Practices and doctors linked to cases cannot be hard-deleted.
- Completed records must retain their history.
- Every critical change must be attributable to a user.
- Protected health information must be minimized and secured.

## 6. Non-Functional Requirements

- Responsive web application for modern desktop browsers.
- Reliable operation on Windows-based laboratory workstations.
- Strong typing across frontend, backend, and shared contracts.
- PostgreSQL-backed persistence for production.
- Automated migrations and seed data.
- Configurable file storage.
- Structured logs and centralized error handling.
- Automated type checking, tests, and build validation.
- Backup and recovery procedures.
- Tenant and location isolation where applicable.
- Accessibility-conscious user interface.
- Clear versioning and release notes.

## 7. Release Definition

A feature is complete only when:

1. Requirements are documented.
2. Data model and permissions are defined.
3. API and interface behavior are implemented.
4. Validation and error states are handled.
5. Tests pass.
6. Build and type checking pass.
7. Audit behavior is verified.
8. Documentation and changelog are updated.

## 8. Initial Release Sequence

- v0.4.0 — Platform foundation
- v0.5.0 — Practice and doctor CRM
- v0.6.0 — Case intake and digital files
- v0.7.0 — Production and QC
- v0.8.0 — Shipping, billing, purchasing, and inventory
- v0.9.0 — Client portal and integrations
- v1.0.0 — Production release
