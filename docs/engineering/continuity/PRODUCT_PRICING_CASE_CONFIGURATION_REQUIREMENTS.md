SUPPLEMENTAL PERMANENT REQUIREMENT
NORTHSTAR PRODUCT, PRICING & CASE CONFIGURATION SYSTEM

THIS REQUIREMENT IS OWNER-APPROVED PERMANENT SCOPE.

It must be recorded in:

• MASTER_BUILD_ROADMAP.md
• FEATURE_STATUS_MATRIX.md
• REQUIREMENT_COMPLIANCE.md
• CURRENT_STATE.md
• SESSION_HANDOFF.md
• NEXT_ACTION.md where appropriate

Do NOT mark this COMPLETE unless the real server-backed functionality actually exists.

Do NOT implement it inside a documentation/reconciliation task unless NEXT_ACTION explicitly authorizes implementation.

Future implementation model:
GPT-5.6 Terra
Fast Mode OFF

────────────────────────────────────────
PRODUCT & PRICING PLATFORM
────────────────────────────────────────

CADence NorthStar requires a highly robust, tenant-isolated Product & Pricing System integrated directly with case creation, Billing/AR, production planning, and turnaround-date calculation.

This is NOT merely a static product dropdown.

Each CADence laboratory tenant must be able to:

• add products
• edit products
• activate/deactivate products
• organize products into restoration categories
• maintain product codes/SKUs
• maintain descriptions
• set pricing
• set pricing basis
• configure turnaround rules
• configure compatible products
• configure required case fields
• create lab-specific custom products
• maintain customer/practice-specific pricing where supported
• maintain effective-dated/versioned price books
• retain historical pricing snapshots

Tenant A product/pricing changes must NEVER affect Tenant B.

Products already used on historical cases/invoices must not be destructively deleted.

Deactivate/archive instead.

────────────────────────────────────────
CASE PRODUCT STACKING
────────────────────────────────────────

ONE CASE MUST SUPPORT MULTIPLE PRODUCTS.

A case may contain multiple product line items when the restoration requires multiple components.

Examples include:

• multiple units
• multiple crowns
• bridge units/components
• multiple implant components
• custom abutment + implant crown
• multiple removable products where legitimately applicable
• multiple arches
• multiple teeth
• other compatible products within the selected restoration workflow

Each line item must independently retain:

• product
• product code
• quantity
• tooth/teeth if applicable
• arch if applicable
• unit count
• price
• pricing basis
• discount/override where authorized
• turnaround contribution
• notes/options
• immutable historical price snapshot after the case is financially committed

The case total must calculate from all stacked products.

Billing must preserve the allocation of charges to each product.

────────────────────────────────────────
PRIMARY RESTORATION TYPE FILTERING
────────────────────────────────────────

Case creation begins with RESTORATION TYPE / PRODUCT CATEGORY.

Supported primary categories:

FIX = Fixed Restorations
REM = Removable Restorations
IMP = Implant Restorations
ORT = Orthodontics
SLP = Sleep Appliances
DIA = Diagnostics & Digital
SPL = Splints
AUX = Auxiliaries

Once a restoration category is selected, the Product selector must automatically show ONLY products permitted for that category.

Example:

If REMOVABLE is selected:

SHOW:
REM products

BLOCK:
FIX
IMP
ORT
SLP
DIA
SPL
AUX

The user must not accidentally assign an incompatible restoration product.

Do not merely hide the wrong choices client-side.

Server validation must reject incompatible product/category combinations.

Product stacking remains available among products permitted by the current restoration workflow.

Any future cross-category compatibility must require an explicit compatibility rule rather than arbitrary selection.

────────────────────────────────────────
DYNAMIC CASE CONFIGURATION
────────────────────────────────────────

The selected category/product must dynamically control which case fields are required.

The system must support configuration concepts such as:

• NONE
• SINGLE TOOTH
• MULTIPLE TEETH
• PARTIAL ARCH
• FULL ARCH
• UPPER
• LOWER
• BOTH ARCHES
• UNIT COUNT
• STAGE COUNT
• COMPONENT COUNT

Do not hard-code one universal case form for every restoration type.

────────────────────────────────────────
REMOVABLE WORKFLOW
────────────────────────────────────────

When REM is selected:

Automatically display ONLY Removable products.

Require appropriate ARCH configuration.

Support:

UPPER
LOWER
BOTH

For COMPLETE/FULL DENTURES:

• allow full upper
• allow full lower
• allow upper + lower
• full arch selection represents the entire appropriate arch

For PARTIAL DENTURES:

• require Upper or Lower
• allow selection of the individual teeth involved/replaced
• support multiple individual teeth
• retain the selected tooth numbers on the product/case line

For products with product-specific limitations, enforce them.

Example:

PAR-FLP Acrylic Flipper is defined as 1–3 teeth.

The product rules must be capable of validating that limitation rather than relying only on staff memory.

The case builder must adapt automatically according to the chosen removable product.

────────────────────────────────────────
FIXED WORKFLOW
────────────────────────────────────────

When FIX is selected:

Automatically show ONLY Fixed Restoration products.

Support tooth/unit selection appropriate to:

• crown
• veneer
• bridge
• inlay/onlay
• provisional
• post/core
• other fixed products

Bridge products must support multiple units and restoration-role information where existing/current case architecture permits.

DEFAULT TURNAROUND:

10 BUSINESS DAYS

The initial due/return date must be automatically calculated from the case entry/received date.

The calculated date remains editable for authorized Rush handling.

Rush override must capture:

• revised due date
• reason
• user
• timestamp

Pricing architecture must support an optional configurable rush charge/rule without hard-coding one universal fee.

────────────────────────────────────────
IMPLANT WORKFLOW
────────────────────────────────────────

When IMP is selected:

Automatically show ONLY Implant Restoration products.

Support stacking required components such as:

• custom/stock abutment
• implant crown
• full-arch restoration
• overdenture component
• verification jig

Maintain implant-specific case information already supported elsewhere in NorthStar.

DEFAULT TURNAROUND:

14 BUSINESS DAYS

Calculate automatically from the case entry/received date.

Authorized Rush override remains available.

────────────────────────────────────────
REMOVABLE TURNAROUND
────────────────────────────────────────

DEFAULT TURNAROUND:

14 BUSINESS DAYS

Calculate automatically from case entry/received date.

Authorized Rush override remains available.

────────────────────────────────────────
BUSINESS-DAY ENGINE
────────────────────────────────────────

Turnaround calculations must use BUSINESS DAYS, not calendar days.

At minimum exclude:

• Saturdays
• Sundays

Architecture must support tenant-configurable:

• holidays
• laboratory closure days
• exceptional closure dates

A laboratory's closure calendar must not affect another tenant.

If the received date or calculated completion date interacts with a closure rule, calculate according to the documented business-day policy.

Never silently overwrite an authorized manual due-date override.

────────────────────────────────────────
MULTI-PRODUCT TURNAROUND
────────────────────────────────────────

Each product must have a configurable turnaround rule.

Current owner defaults:

FIX = 10 business days
IMP = 14 business days
REM = 14 business days

Do not alter existing approved turnaround rules for other product categories during this requirement capture.

For a case containing multiple products, architecture must calculate the case completion requirement deterministically from the applicable product turnaround rules.

If future compatible products have different turnaround periods, the case must not promise completion before all required products can be completed unless an authorized override exists.

────────────────────────────────────────
ROBUST PRICING MODEL
────────────────────────────────────────

Product pricing must support multiple pricing bases, including as applicable:

• per tooth/unit
• per product
• per arch
• per case
• per component
• per stage
• quantity-based

Do not assume every dental product is priced per tooth.

Support:

• base price
• effective date
• expiration/superseded date
• active/inactive
• customer/practice-specific price
• authorized manual override
• discount
• rush pricing/rules
• tax/fee treatment where applicable
• version history

Historical cases/invoices must preserve the price actually agreed/used at that time.

Changing today's product price must NOT rewrite historical case/invoice totals.

────────────────────────────────────────
PRODUCT COMPATIBILITY ENGINE
────────────────────────────────────────

The Product System must support explicit compatibility rules.

Examples:

• products allowed to stack
• products mutually exclusive
• required companion components
• maximum/minimum quantity
• allowed arch
• allowed tooth count
• allowed restoration category
• product dependencies

Invalid combinations must be rejected server-side.

The UI should explain why an incompatible item cannot be selected.

────────────────────────────────────────
INITIAL OWNER-APPROVED PRODUCT CATALOG
────────────────────────────────────────

The following catalog must be captured as the initial NorthStar product foundation/template.

I. FIXED RESTORATIONS — FIX

FIX-ZIR / ZIR-MONO — Monolithic Zirconia (High-Strength/Posterior)
FIX-ZIR / ZIR-ESTH — Aesthetic Zirconia (High-Translucency/Anterior)
FIX-ZIR / ZIR-ML — Multi-Layered Zirconia (Gradient Shading)
FIX-PFZ / PFZ — Porcelain-Fused-to-Zirconia (Layered)
FIX-VNR / VNR-EMX — e.max Veneer (Lithium Disilicate)
FIX-VNR / VNR-ZIR — Zirconia Veneer (Ultra-Thin/High Strength)
FIX-VNR / VNR-FEL — Feldspathic Porcelain Veneer (Refractory)
FIX-CRN / CRN-EMX — Lithium Disilicate Crown (e.max)
FIX-CRN / FGC-HNY — Full Cast Gold: High Noble Yellow
FIX-CRN / FGC-HNW — Full Cast Gold: High Noble White
FIX-CRN / FGC-SP — Full Cast Metal: Semi-Precious (Noble)
FIX-CRN / FGC-NP — Full Cast Metal: Non-Precious (Base Metal)
FIX-PFM / PFM-HNY — PFM: High Noble Yellow Gold Base
FIX-PFM / PFM-HNW — PFM: High Noble White Gold Base
FIX-PFM / PFM-SP — PFM: Semi-Precious (Noble Base)
FIX-PFM / PFM-NP — PFM: Non-Precious (Base Metal)
FIX-BRG / BRG-ZIR — Bridge - Monolithic Zirconia
FIX-BRG / BRG-PFM — Bridge - PFM Fixed
FIX-BRG / BRG-EMX — Bridge - Lithium Disilicate (e.max)
FIX-ION / ION-EMX — Inlay/Onlay - Lithium Disilicate (e.max)
FIX-ION / ION-GLD — Inlay/Onlay - Full Cast Gold
FIX-ION / ION-COM — Inlay/Onlay - Composite Resin
FIX-PROV / PRV-PMMA — Provisional Crown/Bridge - PMMA Milled
FIX-PROV / PRV-PRNT — Provisional Crown/Bridge - 3D Printed Resin
FIX-PROV / BRG-MDLY — Maryland Bridge - Resin Bonded Composite
FIX-POST / PST-HN — Cast Post & Core - High Noble
FIX-POST / PST-NP — Cast Post & Core - Non-Precious

II. REMOVABLE RESTORATIONS — REM

REM-DEN / DEN-PREM — Complete Denture: Premium Acrylic
REM-DEN / DEN-ECON — Complete Denture: Economy/Standard Acrylic
REM-DEN / DEN-IMM — Immediate Denture - Premium Acrylic
REM-DEN / DEN-PRNT — Denture Base: 3D Printed Digital
REM-PAR / PAR-MET — Partial: Cast Metal (Chrome-Cobalt)
REM-PAR / PAR-VIT — Partial: Vitallium (Premium Metal)
REM-PAR / PAR-FLX — Partial: Flexible (Valplast/Nylon)
REM-PAR / PAR-FLP — Partial: Acrylic Flipper (1-3 Teeth)
REM-PAR / PAR-ACTL — Partial: Acetal Resin Framework (Clear/Tooth Colored)
REM-REB / REM-REB — Denture Rebase - Lab Heat Cured
REM-REL / REL-HRD — Denture Reline - Hard Cured
REM-REL / REL-SFT — Denture Reline - Soft Cured
REM-REP / REM-REP — Denture Repair - Tooth Addition/Fracture

III. IMPLANT RESTORATIONS — IMP

IMP-ABT / ABT-TI — Custom Abutment: Titanium
IMP-ABT / ABT-ZIR — Custom Abutment: Zirconia with Ti-Base
IMP-ABT / ABT-STK — Stock Abutment: Prefabricated Manufacturer
IMP-CRN / IC-SCRW-ZIR — Implant Crown: Screw-Retained Monolithic Zirconia
IMP-CRN / IC-SCRW-PFZ — Implant Crown: Screw-Retained Layered PFZ
IMP-CRN / IC-CMNT-ZIR — Implant Crown: Cement-Retained Monolithic Zirconia
IMP-CRN / IC-CMNT-PFM — Implant Crown: Cement-Retained PFM
IMP-ARCH / HYB-ZIR — Full Arch Fixed: Monolithic Zirconia Bridge
IMP-ARCH / HYB-TI — Full Arch Hybrid: Acrylic over Titanium Bar
IMP-ARCH / HYB-PEKK — Full Arch Fixed: Pekkton/BioHPP Framework with Composite
IMP-OVR / OVR-LOC — Overdenture: Locator Retained Framework
IMP-OVR / OVR-BAR — Overdenture: Bar Retained (Hader/Dolder Bar)
IMP-VAL / IMP-JIG — Implant Verification Jig / Verification Bar

IV. ORTHODONTICS — ORT

ORT-ALN / ALN-COMP — Clear Aligner: Comprehensive (Invisalign/In-House)
ORT-ALN / ALN-EXP — Clear Aligner: Express / Minor Movement (1-10 Stages)
ORT-BRC / BRC-MET — Braces: Traditional Stainless Steel
ORT-BRC / BRC-CER — Braces: Ceramic / Aesthetic Clear
ORT-BRC / BRC-LIN — Braces: Lingual Custom System
ORT-EXP / EXP-RPE — Palatal Expander: Fixed Rapid Palatal (RPE)
ORT-EXP / EXP-QUAD — Palatal Expander: Removable Quad Helix
ORT-RET / RET-ESSX — Retainer: Essix (Clear Vacuum Formed)
ORT-RET / RET-HWLY — Retainer: Hawley (Wire & Acrylic)
ORT-RET / RET-FXD — Retainer: Fixed Lingual Bonded Wire
ORT-APP / APP-HRBST — Orthodontic Functional Appliance: Herbst
ORT-APP / APP-TWIN — Orthodontic Functional Appliance: Twin Block
ORT-APP / APP-BION — Orthodontic Functional Appliance: Bionator

V. SLEEP APPLIANCES — SLP

SLP-MAD / MAD-ADJ — Mandibular Advancement: Adjustable (Herbst Style)
SLP-MAD / MAD-NYL — Mandibular Advancement: Custom Milled Nylon (ProSomnus Style)
SLP-MAD / MAD-PANTH — Mandibular Advancement: Panthera Classic Type
SLP-MAD / MAD-TAP — Mandibular Advancement: TAP (Thornton Adjustable)
SLP-TRD / TRD-SIL — Tongue Retaining Device: Medical Grade Silicone
SLP-EMA / SLP-EMA — Elastic Mandibular Advancement Appliance

VI. DIAGNOSTICS & DIGITAL — DIA

DIA-WUP / WUP-CONV — Diagnostic Wax-Up: Conventional White Wax
DIA-WUP / WUP-DIG — Diagnostic Wax-Up: Digital Milled/Printed
DIA-MDL / MDL-PLST — Study Model: White Orthodontic Plaster
DIA-MDL / MDL-PRNT — Digital Model: 3D Printed Polyurethane
DIA-STN / SST-GUIDE — Surgical Guide: Implant Single Site (3D Printed)
DIA-STN / MST-GUIDE — Surgical Guide: Implant Multi-Site/Full Arch
DIA-CTS / DIA-RAD — CT/CB Scan Stent with Radiopaque Markers

VII. SPLINTS & AUXILIARIES — SPL / AUX

SPL-NGD / NGD-HRD — Night Guard: Hard Clear Acrylic (Heat Cured)
SPL-NGD / NGD-SFT — Night Guard: Soft Vacuum Formed EEV/Silicone
SPL-NGD / NGD-DUAL — Night Guard: Dual Laminate (Hard/Soft)
SPL-MGD / MGD-ATHL — Athletic Mouthguard: Custom Multi-Layer Pro
SPL-DEPR / SPL-KOIS — Anterior Deprogrammer: Kois / Lucia Jig
SPL-NTI / SPL-NTI — NTI-tss Tension Suppression Appliance
AUX-SDR / AUX-BLCH — Bleaching/Whitening Trays (Reservoir Style)
AUX-SDR / AUX-TRAY — Custom Impression Tray: Light Cured Resin

────────────────────────────────────────
CASE BUILDER EXPERIENCE
────────────────────────────────────────

The New Case workflow must eventually operate approximately as:

RESTORATION CATEGORY
→
ELIGIBLE PRODUCT(S)
→
ARCH / TOOTH CONFIGURATION
→
STACK ADDITIONAL COMPATIBLE PRODUCT(S)
→
PRODUCT-SPECIFIC OPTIONS
→
AUTO TURNAROUND
→
PRICE CALCULATION
→
CASE TOTAL
→
PRODUCTION REQUIREMENTS

Product/category changes must dynamically update dependent selections.

Do not silently preserve invalid selections after changing categories.

Warn the user and clear/revalidate incompatible selections safely.

────────────────────────────────────────
BILLING / PRODUCTION INTEGRATION
────────────────────────────────────────

Selected case products must become authoritative structured case line items.

They must be usable downstream by:

• Production
• QC
• Shipping
• Billing/AR
• Analytics
• profitability reporting where supported
• future GVM/vendor outsourcing
• Design Studio workflow mapping where applicable

Do not make Product/Pricing a disconnected administrative module.

────────────────────────────────────────
FEATURE STATUS REQUIREMENT
────────────────────────────────────────

During feature reconciliation, explicitly report:

PRODUCT_CATALOG =
COMPLETE / PARTIAL / NOT STARTED

PRICING_ENGINE =
COMPLETE / PARTIAL / NOT STARTED

MULTI_PRODUCT_CASE_STACKING =
COMPLETE / PARTIAL / NOT STARTED

CATEGORY_FILTERING =
COMPLETE / PARTIAL / NOT STARTED

ARCH_TOOTH_CONFIGURATION =
COMPLETE / PARTIAL / NOT STARTED

BUSINESS_DAY_TAT_ENGINE =
COMPLETE / PARTIAL / NOT STARTED

PRICE_VERSIONING =
COMPLETE / PARTIAL / NOT STARTED

CASE_TO_BILLING_PRODUCT_LINEAGE =
COMPLETE / PARTIAL / NOT STARTED

Do not infer completion merely because a product dropdown currently exists.