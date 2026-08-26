# PP-1B-F2A Authorized Handoff

Status: authorized next implementation scope after PP-1B-F1.
Recorded after PR #44 merged on 2026-08-26.
Implementation status: NOT STARTED.
This record is a scope lock; it does not authorize PP-1C, Logistics, MES, Clinic Supply, private-corpus certification, geometry certification, or Design Studio changes.

## F1 boundary and handoff

PP-1B-F1 Case Journey Foundation is OWNER APPROVED / CERTIFIED / MERGED through PR #44.

Owner-approved product head: b55348ea8d0822ff1e23d40a97d6e54176e7d760
Owner-approved product tree: d7425b1fee5ee2aee374b68727c913f0177d0a94
Merge commit: c38d404ee87131fa49166b77d9f9e24c0f1c8cfa

F1 remains the authority for NEW, REMAKE, REPAIR, and CONTINUATION lineage; direct parent locking; server-resolved root; tenant catalogs; explicit responsibility; unassigned continuation stage/state; inherited tenant billing policy; preview-before-create; migration 0013; tenant isolation; and the approved NorthStar shell. F1 creates no invoice and does not implement the Case Builder.

## Authorized next action

PP-1B-F2A — Authoritative Product Catalog Case Builder, Dynamic Product Configuration, Multi-Product Stacking, TAT, and Case Lifecycle Foundation.

Do not duplicate or replace the approved F1 Case Intake with a second product authority. Do not begin implementation until the next task explicitly authorizes F2A.

## A. One authoritative Product Catalog

The temporary Restoration and Material controls in Case Intake are not the final Case Builder.

Case Intake must consume the same tenant Product Catalog managed in Product & Pricing Administration:

Product & Pricing Administration -> Case Builder -> Case Product Lines -> Production -> QC -> Shipment -> future Billing.

Do not maintain a duplicate independent Restoration/Product list inside Case Intake. Tenant administrator create, activation/inactivation, archive, configuration, and pricing changes must be respected by Case Intake. Inactive or archived products are unavailable for new selection. Historical cases retain their saved product and pricing snapshots. Prices must come from the authoritative tenant catalog; do not invent prices.

## B. Cascading Case Builder

Use progressive disclosure and show only relevant fields. The intended sequence is:

1. Case Relationship
2. Practice
3. Doctor
4. Patient
5. Restoration Category
6. Subtype / Product Family
7. Eligible Product(s)
8. Material / Product choice
9. Arch / Teeth / Units / Quantity / Stage / Components
10. Product-specific requirements
11. Compatible stacked Product Lines
12. Authoritative current price
13. Business-day TAT
14. Calculated due date
15. Lifecycle / Hold status where applicable
16. Case Preview
17. Saved Case Product Lines

Do not create one giant irrelevant form.

## C. Taxonomy reconciliation

Reconcile the owner's Case Builder taxonomy against the approved PP-1A tenant catalog of 87 products. Do not blindly create a second catalog. The approved top-level catalog authority includes FIX, REM, IMP, ORT, SLP, DIA, SPL, and AUX.

Report before adding products:

- products already represented;
- products represented under a different SKU or family;
- genuinely missing products;
- configuration metadata gaps; and
- category or code conflicts.

Owner-facing groupings to reconcile include:

- FIXED: Single Crown; Multi-Unit Bridge; Inlay / Onlay; Veneer. Representative materials/products include Monolithic Zirconia, Layered/Esthetic Zirconia, Lithium Disilicate / e.max, PFZ, PFM High Noble, PFM Noble, PFM Base Metal, Full Cast Gold, Full Cast Metal, indirect Composite / PMMA, and Feldspathic Porcelain.
- REMOVABLE: Complete Denture; Cast Partial; Flexible Partial; Hybrid Partial; Natural Overdenture; Interim / Flipper.
- IMPLANT: Abutment Only; Screw-Retained Crown; Cement-Retained Crown; Multi-Unit Bridge; Full-Arch Fixed Hybrid; Implant Overdenture.
- SLEEP: Mandibular Advancement; Tongue Stabilizing.
- ORTHODONTIC: Clear Aligner; Fixed Appliance; Removable Retainer.
- SURGICAL / DIGITAL / DIAGNOSTIC: Implant Guide; Wax-Up; Stent / Template; and other owner-approved tenant products.

## D. Product-specific configuration

Drive requirements from structured product metadata and expose only relevant configuration.

Fixed products may require tooth/teeth, prep scan, opposing, bite, shade, stump shade, alloy, margin design, pontic, connector/span, and cement protocol.

Removable products may require upper/lower/both, selected teeth where applicable, custom tray, wax rim / bite block, tooth shade/mold, framework, clasp, and attachment configuration.

Implant products may require manufacturer/system, platform, scan body, analog, Ti-base, MUA, screw, locator, bar, verification jig, and access-hole configuration.

Orthodontic products may require arch, stages, attachments, IPR, wire/band, and retainer configuration.

Guide / Diagnostic products may require DICOM / CBCT, STL/scan requirements, drill sleeve/system, and printed/analogue workflow.

## E. Multi-product stacking

A case may contain multiple Case Product Lines; do not flatten a stack into one Restoration text value.

Examples include Custom Abutment + Zirconia Crown + screw/component, and Full-Arch Bar + prosthetic superstructure + associated components.

Each line retains product ID, SKU, product-name snapshot, configuration snapshot, quantity, arch / teeth, price-version snapshot, TAT, and a stable lineage ID. Compatibility rules govern allowed stacks.

## F. Arch, tooth, and quantity semantics

Selections must respond to product type:

- Single Crown: individual tooth.
- Bridge: multiple teeth, abutments, and pontics.
- Complete Denture: Upper, Lower, or Both.
- Partial: Arch plus individual teeth.
- Full-Arch Implant: Upper, Lower, or Both where supported.

Do not request irrelevant configuration.

## G. TAT and due dates

Default owner policy is:

- FIXED: 10 business days.
- REMOVABLE: 14 business days.
- IMPLANT: 14 business days.
- SLEEP: 14 business days.
- Other categories/products: authoritative tenant/product TAT.

The business-day engine excludes weekends and configured tenant closures/holidays. The system calculates due dates automatically. An authorized manual override preserves the original calculated date, new date, reason, user, and timestamp. For stacked products, the Case due date cannot promise completion before all required products can complete unless an authorized override exists. Original TAT history must never be erased.

## H. Case lifecycle, Hold, and Release

Case Relationship and Case Lifecycle are separate dimensions. Relationship remains NEW, REMAKE, REPAIR, or CONTINUATION. Any case may independently be ACTIVE / IN PROCESS, ON HOLD, RELEASED / RESUMED, or CANCELLED.

Authorized users need PLACE ON HOLD and RELEASE HOLD. A hold captures structured reason, optional notes, user, timestamp, current workflow/production state, original due date, TAT pause behavior, and supporting communication/evidence where available.

Hold must not delete or replace the Case, Case Number, Patient, Doctor/Practice, Root/Parent lineage, Case Product Lines, Product/Pricing snapshots, attachments, or audit history.

Tenant/reason policy must distinguish PAUSES TAT from DOES NOT PAUSE TAT. When TAT pauses, preserve original due date, hold start, release time, paused duration/business days, and recalculated due date.

## I. Controlled Hold Reasons

Seed tenant-configurable structured reason codes; tenants may activate, deactivate, or add reasons, and reason codes remain stable for history. Hold reasons never automatically assign fault.

Clinical / Quality: CLN-Margin (margin unreadable / covered by tissue), CLN-Clearance (insufficient occlusal reduction), CLN-Distortion (physical pull or digital scan data void), CLN-Bite (opposing arches do not articulate / clash), CLN-Undercut (path of insertion blocked by undercut), CLN-MUA-Ang (MUA angle unfeasible), CLN-Tissue (soft tissue compression / interference), CLN-Implant-Mob (implant failure risk / mobility concern).

Prescription / Design: RX-Shade (missing final shade), RX-Stump (missing stump shade), RX-Material (material unspecified), RX-System (missing implant brand/platform), RX-Opposing (missing opposing arch), RX-Pontic (missing pontic design), RX-Margin-Des (margin design not selected), RX-Clasp (partial clasp type/placement missing).

Logistics / Inventory: MAT-Backorder (parts/materials unavailable), MAT-Missing (required parts/screws/jigs not received), MAT-Enclosure (required fit-to item missing), MAT-File-Corrupt (corrupt digital files), MAT-Model-Fx (physical model damaged).

Recommendation / Alteration: REC-Material (lab recommends material change), REC-TryIn (try-in required), REC-Jig (verification jig required), REC-Prep (re-preparation recommended), REC-Schedule (requested timeline incompatible with required TAT).

Administrative: ADM-Credit (authorized account/credit hold), ADM-No-ID (missing Doctor/Practice/Patient identity), ADM-Signature (missing prescription authorization), ADM-Duplicate (potential duplicate submission).

## J. Cancellation

Cancellation is not deletion. Authorized users need CANCEL CASE with preview and confirmation. Cancellation preserves Case, future Case Number, Relationship, Root/Parent lineage, Patient, Doctor, Practice, Product Lines, Product/Pricing snapshots, attachments, production history, financial history, cancellation reason, user, timestamp, and audit trail. Production and release actions stop after effective cancellation.

Controlled cancellation reasons are tenant-configurable and history-stable:

- Clinical: CLN-Remake-Req, CLN-Patient-Loss, CLN-Treatment-Chg, CLN-Implant-Fail, CLN-Abutment-Mob, CLN-Health-Issue.
- Prescription / Design: RX-Dr-Request, RX-Incomplete, RX-Spec-Mism, RX-Lab-Incapable.
- Material / Logistics: MAT-Timeline, MAT-Data-Lost, MAT-Discontinued, MAT-Inbound-Dmg.
- Administrative / Financial: ADM-Duplicate, ADM-Bad-Debt, ADM-Entered-Err, ADM-Dr-Discharge.

Do not automatically infer fault. If downstream financial activity exists, never delete invoice/payment history; future PP-1C must use the appropriate adjustment, credit memo, reversal, or authorized write-off.

## K. Future Case Number

Every confirmed case must receive a unique, immutable, human-readable Case Number. The recommended tenant-configurable concept is RELATIONSHIP-DOCTORCODE-DATE-SEQUENCE, for example N-BEWU-260826-0017, with possible relationship prefixes N, R, P, and C. Relational IDs remain authoritative. Doctor-name changes do not alter issued numbers, and concurrency must prevent duplicates.

## L. Patient and Doctor identity

Do not require users to invent a mandatory NorthStar Patient Number. Patient remains First Name, Last Name, DOB where available, and optional external Patient Reference. One Patient may have many Cases, and Case Numbers appear in Patient history.

Future Doctor creation needs an automatic unique stable Doctor Account Number, First Name, Last Name, Practice, professional License Number, controlled Dental Specialty, contact data, and status data. Specialty concepts include General Dentist, Prosthodontist, Periodontist, Endodontist, Orthodontist, Pediatric Dentist, Oral & Maxillofacial Surgeon, Oral & Maxillofacial Pathologist, Oral & Maxillofacial Radiologist, Dental Anesthesiologist, Dental Public Health, and Other; verify the final production taxonomy before locking. Name changes do not change the account number.

## M. Tax profile and certificates

Future Doctor/Practice financial profiles must support documented state tax exemption, local tax exemption, applicable federal exemption classification, certificate/document upload, certificate/reference number, effective date, expiration date where applicable, and notes. NorthStar must not invent legal tax determinations. Preserve Doctor-level and Practice-level billing/tax architecture as appropriate.

## N. Future PP-1C billing lineage

Do not implement PP-1C in F2A. Preserve the future lineage:

Case -> Case Product Lines -> Production -> QC -> Shipment -> Invoice Lines -> Invoice -> Statement -> Payment/Reconciliation.

Invoices must be able to show Doctor name, Practice, Doctor Account Number, Patient name, Case Number, Product/restoration, teeth/arch/quantity, authoritative price, adjustments, amount due, and completion date. Statements consolidate actual invoices and preserve Doctor, Practice, Account Number, Patient, Case Number, Invoice Number, dates, charges, payments, adjustments, and remaining balance. Invoice and Shipment remain separate linked entities.

## Explicit exclusions

This is a future-scope record, not implementation authorization. Do not begin PP-1B-F2A in the F1 merge task. Do not begin PP-1C. Do not change the approved NorthStar shell or Design Studio geometry without explicit owner approval. Do not run private dental corpus or geometry certification for this handoff.
