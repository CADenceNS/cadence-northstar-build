BEGIN;

-- PP-1A keeps the historic intake catalog intact while adding the tenant-owned
-- product, price, and case-line foundation required by NorthStar.
ALTER TABLE product_catalog
  ADD COLUMN IF NOT EXISTS category_code text,
  ADD COLUMN IF NOT EXISTS family_code text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS pricing_basis text,
  ADD COLUMN IF NOT EXISTS default_turnaround_business_days integer,
  ADD COLUMN IF NOT EXISTS configuration_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS compatibility_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE product_catalog
  ADD CONSTRAINT product_catalog_category_code_check CHECK (category_code IS NULL OR category_code IN ('FIX','REM','IMP','ORT','SLP','DIA','SPL','AUX')),
  ADD CONSTRAINT product_catalog_pricing_basis_check CHECK (pricing_basis IS NULL OR pricing_basis IN ('PER_UNIT','PER_TOOTH','PER_PRODUCT','PER_ARCH','PER_CASE','PER_COMPONENT','PER_STAGE','QUANTITY_BASED')),
  ADD CONSTRAINT product_catalog_turnaround_check CHECK (default_turnaround_business_days IS NULL OR default_turnaround_business_days > 0),
  ADD CONSTRAINT product_catalog_tenant_id_unique UNIQUE (tenant_id,id);

-- Composite tenant keys make every new PP-1A relation reject cross-tenant IDs
-- at the database boundary as well as in the request service.
ALTER TABLE clinical_cases
  ADD CONSTRAINT clinical_cases_tenant_id_unique UNIQUE (tenant_id,id);

CREATE TABLE product_catalog_templates (
  sku text PRIMARY KEY,
  category_code text NOT NULL CHECK (category_code IN ('FIX','REM','IMP','ORT','SLP','DIA','SPL','AUX')),
  family_code text NOT NULL,
  product_name text NOT NULL,
  description text NOT NULL,
  restoration_subtype text NOT NULL,
  department text NOT NULL,
  accounting_category text NOT NULL,
  pricing_basis text NOT NULL CHECK (pricing_basis IN ('PER_UNIT','PER_TOOTH','PER_PRODUCT','PER_ARCH','PER_CASE','PER_COMPONENT','PER_STAGE','QUANTITY_BASED')),
  default_turnaround_business_days integer,
  configuration_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  compatibility_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The supplied owner catalog is intentionally seeded as a template, not with
-- invented prices. Each tenant receives tenant-owned copies below.
INSERT INTO product_catalog_templates(sku,category_code,family_code,product_name,description,restoration_subtype,department,accounting_category,pricing_basis,default_turnaround_business_days,configuration_metadata) VALUES
('ZIR-MONO','FIX','FIX-ZIR','Monolithic Zirconia','Monolithic Zirconia (High-Strength/Posterior)','Monolithic Zirconia','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('ZIR-ESTH','FIX','FIX-ZIR','Aesthetic Zirconia','Aesthetic Zirconia (High-Translucency/Anterior)','Aesthetic Zirconia','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('ZIR-ML','FIX','FIX-ZIR','Multi-Layered Zirconia','Multi-Layered Zirconia (Gradient Shading)','Multi-Layered Zirconia','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('PFZ','FIX','FIX-PFZ','Porcelain-Fused-to-Zirconia','Porcelain-Fused-to-Zirconia (Layered)','Porcelain-Fused-to-Zirconia','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('VNR-EMX','FIX','FIX-VNR','e.max Veneer','e.max Veneer (Lithium Disilicate)','e.max Veneer','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('VNR-ZIR','FIX','FIX-VNR','Zirconia Veneer','Zirconia Veneer (Ultra-Thin/High Strength)','Zirconia Veneer','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('VNR-FEL','FIX','FIX-VNR','Feldspathic Porcelain Veneer','Feldspathic Porcelain Veneer (Refractory)','Feldspathic Porcelain Veneer','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('CRN-EMX','FIX','FIX-CRN','Lithium Disilicate Crown','Lithium Disilicate Crown (e.max)','Lithium Disilicate Crown','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('FGC-HNY','FIX','FIX-CRN','Full Cast Gold: High Noble Yellow','Full Cast Gold: High Noble Yellow','Full Cast Gold','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('FGC-HNW','FIX','FIX-CRN','Full Cast Gold: High Noble White','Full Cast Gold: High Noble White','Full Cast Gold','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('FGC-SP','FIX','FIX-CRN','Full Cast Metal: Semi-Precious','Full Cast Metal: Semi-Precious (Noble)','Full Cast Metal','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('FGC-NP','FIX','FIX-CRN','Full Cast Metal: Non-Precious','Full Cast Metal: Non-Precious (Base Metal)','Full Cast Metal','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('PFM-HNY','FIX','FIX-PFM','PFM: High Noble Yellow Gold Base','PFM: High Noble Yellow Gold Base','PFM','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('PFM-HNW','FIX','FIX-PFM','PFM: High Noble White Gold Base','PFM: High Noble White Gold Base','PFM','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('PFM-SP','FIX','FIX-PFM','PFM: Semi-Precious','PFM: Semi-Precious (Noble Base)','PFM','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('PFM-NP','FIX','FIX-PFM','PFM: Non-Precious','PFM: Non-Precious (Base Metal)','PFM','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('BRG-ZIR','FIX','FIX-BRG','Bridge - Monolithic Zirconia','Bridge - Monolithic Zirconia','Bridge','fixed','Fixed Restorations','PER_UNIT',10,'{"selection":"MULTIPLE_TEETH","minUnits":2,"allowedArches":["upper","lower","both"]}'),
('BRG-PFM','FIX','FIX-BRG','Bridge - PFM Fixed','Bridge - PFM Fixed','Bridge','fixed','Fixed Restorations','PER_UNIT',10,'{"selection":"MULTIPLE_TEETH","minUnits":2,"allowedArches":["upper","lower","both"]}'),
('BRG-EMX','FIX','FIX-BRG','Bridge - Lithium Disilicate','Bridge - Lithium Disilicate (e.max)','Bridge','fixed','Fixed Restorations','PER_UNIT',10,'{"selection":"MULTIPLE_TEETH","minUnits":2,"allowedArches":["upper","lower","both"]}'),
('ION-EMX','FIX','FIX-ION','Inlay/Onlay - Lithium Disilicate','Inlay/Onlay - Lithium Disilicate (e.max)','Inlay/Onlay','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('ION-GLD','FIX','FIX-ION','Inlay/Onlay - Full Cast Gold','Inlay/Onlay - Full Cast Gold','Inlay/Onlay','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('ION-COM','FIX','FIX-ION','Inlay/Onlay - Composite Resin','Inlay/Onlay - Composite Resin','Inlay/Onlay','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('PRV-PMMA','FIX','FIX-PROV','Provisional Crown/Bridge - PMMA Milled','Provisional Crown/Bridge - PMMA Milled','Provisional Crown/Bridge','fixed','Fixed Restorations','PER_UNIT',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('PRV-PRNT','FIX','FIX-PROV','Provisional Crown/Bridge - 3D Printed Resin','Provisional Crown/Bridge - 3D Printed Resin','Provisional Crown/Bridge','fixed','Fixed Restorations','PER_UNIT',10,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('BRG-MDLY','FIX','FIX-PROV','Maryland Bridge - Resin Bonded Composite','Maryland Bridge - Resin Bonded Composite','Maryland Bridge','fixed','Fixed Restorations','PER_UNIT',10,'{"selection":"MULTIPLE_TEETH","minUnits":2,"allowedArches":["upper","lower","both"]}'),
('PST-HN','FIX','FIX-POST','Cast Post & Core - High Noble','Cast Post & Core - High Noble','Post & Core','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"SINGLE_TOOTH","allowedArches":["upper","lower"]}'),
('PST-NP','FIX','FIX-POST','Cast Post & Core - Non-Precious','Cast Post & Core - Non-Precious','Post & Core','fixed','Fixed Restorations','PER_TOOTH',10,'{"selection":"SINGLE_TOOTH","allowedArches":["upper","lower"]}'),
('DEN-PREM','REM','REM-DEN','Complete Denture: Premium Acrylic','Complete Denture: Premium Acrylic','Complete Denture','removables','Removable Restorations','PER_ARCH',14,'{"selection":"FULL_ARCH","allowedArches":["upper","lower","both"]}'),
('DEN-ECON','REM','REM-DEN','Complete Denture: Economy/Standard Acrylic','Complete Denture: Economy/Standard Acrylic','removables','removables','Removable Restorations','PER_ARCH',14,'{"selection":"FULL_ARCH","allowedArches":["upper","lower","both"]}'),
('DEN-IMM','REM','REM-DEN','Immediate Denture - Premium Acrylic','Immediate Denture - Premium Acrylic','removables','removables','Removable Restorations','PER_ARCH',14,'{"selection":"FULL_ARCH","allowedArches":["upper","lower","both"]}'),
('DEN-PRNT','REM','REM-DEN','Denture Base: 3D Printed Digital','Denture Base: 3D Printed Digital','removables','removables','Removable Restorations','PER_ARCH',14,'{"selection":"FULL_ARCH","allowedArches":["upper","lower","both"]}'),
('PAR-MET','REM','REM-PAR','Partial: Cast Metal','Partial: Cast Metal (Chrome-Cobalt)','Partial Denture','removables','Removable Restorations','PER_ARCH',14,'{"selection":"PARTIAL_ARCH","allowedArches":["upper","lower"],"minTeeth":1}'),
('PAR-VIT','REM','REM-PAR','Partial: Vitallium','Partial: Vitallium (Premium Metal)','Partial Denture','removables','Removable Restorations','PER_ARCH',14,'{"selection":"PARTIAL_ARCH","allowedArches":["upper","lower"],"minTeeth":1}'),
('PAR-FLX','REM','REM-PAR','Partial: Flexible','Partial: Flexible (Valplast/Nylon)','Partial Denture','removables','Removable Restorations','PER_ARCH',14,'{"selection":"PARTIAL_ARCH","allowedArches":["upper","lower"],"minTeeth":1}'),
('PAR-FLP','REM','REM-PAR','Partial: Acrylic Flipper','Partial: Acrylic Flipper (1-3 Teeth)','Partial Denture','removables','Removable Restorations','PER_TOOTH',14,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower"],"minTeeth":1,"maxTeeth":3}'),
('PAR-ACTL','REM','REM-PAR','Partial: Acetal Resin Framework','Partial: Acetal Resin Framework (Clear/Tooth Colored)','Partial Denture','removables','Removable Restorations','PER_ARCH',14,'{"selection":"PARTIAL_ARCH","allowedArches":["upper","lower"],"minTeeth":1}'),
('REM-REB','REM','REM-REB','Denture Rebase - Lab Heat Cured','Denture Rebase - Lab Heat Cured','Denture Rebase','removables','Removable Restorations','PER_PRODUCT',14,'{"selection":"FULL_ARCH","allowedArches":["upper","lower"]}'),
('REL-HRD','REM','REM-REL','Denture Reline - Hard Cured','Denture Reline - Hard Cured','Denture Reline','removables','Removable Restorations','PER_PRODUCT',14,'{"selection":"FULL_ARCH","allowedArches":["upper","lower"]}'),
('REL-SFT','REM','REM-REL','Denture Reline - Soft Cured','Denture Reline - Soft Cured','Denture Reline','removables','Removable Restorations','PER_PRODUCT',14,'{"selection":"FULL_ARCH","allowedArches":["upper","lower"]}'),
('REM-REP','REM','REM-REP','Denture Repair - Tooth Addition/Fracture','Denture Repair - Tooth Addition/Fracture','Denture Repair','removables','Removable Restorations','PER_PRODUCT',14,'{"selection":"PARTIAL_ARCH","allowedArches":["upper","lower"],"minTeeth":1}'),
('ABT-TI','IMP','IMP-ABT','Custom Abutment: Titanium','Custom Abutment: Titanium','Custom Abutment','implants','Implant Restorations','PER_COMPONENT',14,'{"selection":"SINGLE_TOOTH","allowedArches":["upper","lower"]}'),
('ABT-ZIR','IMP','IMP-ABT','Custom Abutment: Zirconia with Ti-Base','Custom Abutment: Zirconia with Ti-Base','Custom Abutment','implants','Implant Restorations','PER_COMPONENT',14,'{"selection":"SINGLE_TOOTH","allowedArches":["upper","lower"]}'),
('ABT-STK','IMP','IMP-ABT','Stock Abutment: Prefabricated Manufacturer','Stock Abutment: Prefabricated Manufacturer','Stock Abutment','implants','Implant Restorations','PER_COMPONENT',14,'{"selection":"SINGLE_TOOTH","allowedArches":["upper","lower"]}'),
('IC-SCRW-ZIR','IMP','IMP-CRN','Implant Crown: Screw-Retained Monolithic Zirconia','Implant Crown: Screw-Retained Monolithic Zirconia','Implant Crown','implants','Implant Restorations','PER_TOOTH',14,'{"selection":"SINGLE_TOOTH","allowedArches":["upper","lower"]}'),
('IC-SCRW-PFZ','IMP','IMP-CRN','Implant Crown: Screw-Retained Layered PFZ','Implant Crown: Screw-Retained Layered PFZ','Implant Crown','implants','Implant Restorations','PER_TOOTH',14,'{"selection":"SINGLE_TOOTH","allowedArches":["upper","lower"]}'),
('IC-CMNT-ZIR','IMP','IMP-CRN','Implant Crown: Cement-Retained Monolithic Zirconia','Implant Crown: Cement-Retained Monolithic Zirconia','Implant Crown','implants','Implant Restorations','PER_TOOTH',14,'{"selection":"SINGLE_TOOTH","allowedArches":["upper","lower"]}'),
('IC-CMNT-PFM','IMP','IMP-CRN','Implant Crown: Cement-Retained PFM','Implant Crown: Cement-Retained PFM','Implant Crown','implants','Implant Restorations','PER_TOOTH',14,'{"selection":"SINGLE_TOOTH","allowedArches":["upper","lower"]}'),
('HYB-ZIR','IMP','IMP-ARCH','Full Arch Fixed: Monolithic Zirconia Bridge','Full Arch Fixed: Monolithic Zirconia Bridge','Full Arch Fixed','implants','Implant Restorations','PER_ARCH',14,'{"selection":"FULL_ARCH","allowedArches":["upper","lower","both"]}'),
('HYB-TI','IMP','IMP-ARCH','Full Arch Hybrid: Acrylic over Titanium Bar','Full Arch Hybrid: Acrylic over Titanium Bar','Full Arch Hybrid','implants','Implant Restorations','PER_ARCH',14,'{"selection":"FULL_ARCH","allowedArches":["upper","lower","both"]}'),
('HYB-PEKK','IMP','IMP-ARCH','Full Arch Fixed: Pekkton/BioHPP Framework with Composite','Full Arch Fixed: Pekkton/BioHPP Framework with Composite','Full Arch Fixed','implants','Implant Restorations','PER_ARCH',14,'{"selection":"FULL_ARCH","allowedArches":["upper","lower","both"]}'),
('OVR-LOC','IMP','IMP-OVR','Overdenture: Locator Retained Framework','Overdenture: Locator Retained Framework','Overdenture','implants','Implant Restorations','PER_ARCH',14,'{"selection":"FULL_ARCH","allowedArches":["upper","lower","both"]}'),
('OVR-BAR','IMP','IMP-OVR','Overdenture: Bar Retained','Overdenture: Bar Retained (Hader/Dolder Bar)','Overdenture','implants','Implant Restorations','PER_ARCH',14,'{"selection":"FULL_ARCH","allowedArches":["upper","lower","both"]}'),
('IMP-JIG','IMP','IMP-VAL','Implant Verification Jig / Verification Bar','Implant Verification Jig / Verification Bar','Verification Jig','implants','Implant Restorations','PER_COMPONENT',14,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('ALN-COMP','ORT','ORT-ALN','Clear Aligner: Comprehensive','Clear Aligner: Comprehensive (Invisalign/In-House)','Clear Aligner','orthodontics','Orthodontics','PER_STAGE',NULL,'{"selection":"STAGE_COUNT","allowedArches":["upper","lower","both"]}'),
('ALN-EXP','ORT','ORT-ALN','Clear Aligner: Express / Minor Movement','Clear Aligner: Express / Minor Movement (1-10 Stages)','Clear Aligner','orthodontics','Orthodontics','PER_STAGE',NULL,'{"selection":"STAGE_COUNT","allowedArches":["upper","lower","both"],"maxStages":10}'),
('BRC-MET','ORT','ORT-BRC','Braces: Traditional Stainless Steel','Braces: Traditional Stainless Steel','Braces','orthodontics','Orthodontics','PER_ARCH',NULL,'{"selection":"FULL_ARCH","allowedArches":["upper","lower","both"]}'),
('BRC-CER','ORT','ORT-BRC','Braces: Ceramic / Aesthetic Clear','Braces: Ceramic / Aesthetic Clear','Braces','orthodontics','Orthodontics','PER_ARCH',NULL,'{"selection":"FULL_ARCH","allowedArches":["upper","lower","both"]}'),
('BRC-LIN','ORT','ORT-BRC','Braces: Lingual Custom System','Braces: Lingual Custom System','Braces','orthodontics','Orthodontics','PER_ARCH',NULL,'{"selection":"FULL_ARCH","allowedArches":["upper","lower","both"]}'),
('EXP-RPE','ORT','ORT-EXP','Palatal Expander: Fixed Rapid Palatal','Palatal Expander: Fixed Rapid Palatal (RPE)','Palatal Expander','orthodontics','Orthodontics','PER_PRODUCT',NULL,'{"selection":"UPPER","allowedArches":["upper"]}'),
('EXP-QUAD','ORT','ORT-EXP','Palatal Expander: Removable Quad Helix','Palatal Expander: Removable Quad Helix','Palatal Expander','orthodontics','Orthodontics','PER_PRODUCT',NULL,'{"selection":"UPPER","allowedArches":["upper"]}'),
('RET-ESSX','ORT','ORT-RET','Retainer: Essix','Retainer: Essix (Clear Vacuum Formed)','Retainer','orthodontics','Orthodontics','PER_ARCH',NULL,'{"selection":"FULL_ARCH","allowedArches":["upper","lower","both"]}'),
('RET-HWLY','ORT','ORT-RET','Retainer: Hawley','Retainer: Hawley (Wire & Acrylic)','Retainer','orthodontics','Orthodontics','PER_ARCH',NULL,'{"selection":"FULL_ARCH","allowedArches":["upper","lower","both"]}'),
('RET-FXD','ORT','ORT-RET','Retainer: Fixed Lingual Bonded Wire','Retainer: Fixed Lingual Bonded Wire','Retainer','orthodontics','Orthodontics','PER_ARCH',NULL,'{"selection":"UPPER","allowedArches":["upper","lower"]}'),
('APP-HRBST','ORT','ORT-APP','Orthodontic Functional Appliance: Herbst','Orthodontic Functional Appliance: Herbst','Functional Appliance','orthodontics','Orthodontics','PER_PRODUCT',NULL,'{"selection":"BOTH_ARCHES","allowedArches":["both"]}'),
('APP-TWIN','ORT','ORT-APP','Orthodontic Functional Appliance: Twin Block','Orthodontic Functional Appliance: Twin Block','Functional Appliance','orthodontics','Orthodontics','PER_PRODUCT',NULL,'{"selection":"BOTH_ARCHES","allowedArches":["both"]}'),
('APP-BION','ORT','ORT-APP','Orthodontic Functional Appliance: Bionator','Orthodontic Functional Appliance: Bionator','Functional Appliance','orthodontics','Orthodontics','PER_PRODUCT',NULL,'{"selection":"BOTH_ARCHES","allowedArches":["both"]}'),
('MAD-ADJ','SLP','SLP-MAD','Mandibular Advancement: Adjustable','Mandibular Advancement: Adjustable (Herbst Style)','Mandibular Advancement','sleep','Sleep Appliances','PER_PRODUCT',NULL,'{"selection":"BOTH_ARCHES","allowedArches":["both"]}'),
('MAD-NYL','SLP','SLP-MAD','Mandibular Advancement: Custom Milled Nylon','Mandibular Advancement: Custom Milled Nylon (ProSomnus Style)','Mandibular Advancement','sleep','Sleep Appliances','PER_PRODUCT',NULL,'{"selection":"BOTH_ARCHES","allowedArches":["both"]}'),
('MAD-PANTH','SLP','SLP-MAD','Mandibular Advancement: Panthera Classic Type','Mandibular Advancement: Panthera Classic Type','Mandibular Advancement','sleep','Sleep Appliances','PER_PRODUCT',NULL,'{"selection":"BOTH_ARCHES","allowedArches":["both"]}'),
('MAD-TAP','SLP','SLP-MAD','Mandibular Advancement: TAP','Mandibular Advancement: TAP (Thornton Adjustable)','Mandibular Advancement','sleep','Sleep Appliances','PER_PRODUCT',NULL,'{"selection":"BOTH_ARCHES","allowedArches":["both"]}'),
('TRD-SIL','SLP','SLP-TRD','Tongue Retaining Device','Tongue Retaining Device: Medical Grade Silicone','Tongue Retaining Device','sleep','Sleep Appliances','PER_PRODUCT',NULL,'{"selection":"BOTH_ARCHES","allowedArches":["both"]}'),
('SLP-EMA','SLP','SLP-EMA','Elastic Mandibular Advancement Appliance','Elastic Mandibular Advancement Appliance','Elastic Mandibular Advancement Appliance','sleep','Sleep Appliances','PER_PRODUCT',NULL,'{"selection":"BOTH_ARCHES","allowedArches":["both"]}'),
('WUP-CONV','DIA','DIA-WUP','Diagnostic Wax-Up: Conventional White Wax','Diagnostic Wax-Up: Conventional White Wax','Diagnostic Wax-Up','diagnostics','Diagnostics & Digital','PER_UNIT',NULL,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('WUP-DIG','DIA','DIA-WUP','Diagnostic Wax-Up: Digital Milled/Printed','Diagnostic Wax-Up: Digital Milled/Printed','Diagnostic Wax-Up','diagnostics','Diagnostics & Digital','PER_UNIT',NULL,'{"selection":"MULTIPLE_TEETH","allowedArches":["upper","lower","both"]}'),
('MDL-PLST','DIA','DIA-MDL','Study Model: White Orthodontic Plaster','Study Model: White Orthodontic Plaster','Study Model','diagnostics','Diagnostics & Digital','PER_ARCH',NULL,'{"selection":"FULL_ARCH","allowedArches":["upper","lower","both"]}'),
('MDL-PRNT','DIA','DIA-MDL','Digital Model: 3D Printed Polyurethane','Digital Model: 3D Printed Polyurethane','Digital Model','diagnostics','Diagnostics & Digital','PER_ARCH',NULL,'{"selection":"FULL_ARCH","allowedArches":["upper","lower","both"]}'),
('SST-GUIDE','DIA','DIA-STN','Surgical Guide: Implant Single Site','Surgical Guide: Implant Single Site (3D Printed)','Surgical Guide','diagnostics','Diagnostics & Digital','PER_TOOTH',NULL,'{"selection":"SINGLE_TOOTH","allowedArches":["upper","lower"]}'),
('MST-GUIDE','DIA','DIA-STN','Surgical Guide: Implant Multi-Site/Full Arch','Surgical Guide: Implant Multi-Site/Full Arch','Surgical Guide','diagnostics','Diagnostics & Digital','PER_ARCH',NULL,'{"selection":"PARTIAL_ARCH","allowedArches":["upper","lower","both"]}'),
('DIA-RAD','DIA','DIA-CTS','CT/CB Scan Stent with Radiopaque Markers','CT/CB Scan Stent with Radiopaque Markers','CT/CB Scan Stent','diagnostics','Diagnostics & Digital','PER_ARCH',NULL,'{"selection":"FULL_ARCH","allowedArches":["upper","lower","both"]}'),
('NGD-HRD','SPL','SPL-NGD','Night Guard: Hard Clear Acrylic','Night Guard: Hard Clear Acrylic (Heat Cured)','Night Guard','splints','Splints','PER_ARCH',NULL,'{"selection":"FULL_ARCH","allowedArches":["upper","lower"]}'),
('NGD-SFT','SPL','SPL-NGD','Night Guard: Soft Vacuum Formed','Night Guard: Soft Vacuum Formed EEV/Silicone','Night Guard','splints','Splints','PER_ARCH',NULL,'{"selection":"FULL_ARCH","allowedArches":["upper","lower"]}'),
('NGD-DUAL','SPL','SPL-NGD','Night Guard: Dual Laminate','Night Guard: Dual Laminate (Hard/Soft)','Night Guard','splints','Splints','PER_ARCH',NULL,'{"selection":"FULL_ARCH","allowedArches":["upper","lower"]}'),
('MGD-ATHL','SPL','SPL-MGD','Athletic Mouthguard','Athletic Mouthguard: Custom Multi-Layer Pro','Athletic Mouthguard','splints','Splints','PER_ARCH',NULL,'{"selection":"FULL_ARCH","allowedArches":["upper","lower"]}'),
('SPL-KOIS','SPL','SPL-DEPR','Anterior Deprogrammer','Anterior Deprogrammer: Kois / Lucia Jig','Anterior Deprogrammer','splints','Splints','PER_PRODUCT',NULL,'{"selection":"UPPER","allowedArches":["upper"]}'),
('SPL-NTI','SPL','SPL-NTI','NTI-tss Tension Suppression Appliance','NTI-tss Tension Suppression Appliance','NTI-tss','splints','Splints','PER_PRODUCT',NULL,'{"selection":"UPPER","allowedArches":["upper"]}'),
('AUX-BLCH','AUX','AUX-SDR','Bleaching/Whitening Trays','Bleaching/Whitening Trays (Reservoir Style)','Bleaching Tray','auxiliaries','Auxiliaries','PER_ARCH',NULL,'{"selection":"FULL_ARCH","allowedArches":["upper","lower","both"]}'),
('AUX-TRAY','AUX','AUX-SDR','Custom Impression Tray','Custom Impression Tray: Light Cured Resin','Impression Tray','Impression Tray','auxiliaries','Auxiliaries','PER_ARCH',NULL,'{"selection":"FULL_ARCH","allowedArches":["upper","lower","both"]}')
ON CONFLICT (sku) DO NOTHING;

INSERT INTO product_catalog(tenant_id,sku,product_name,restoration_category,restoration_subtype,department,accounting_category,tax_status,turnaround_category,category_code,family_code,description,pricing_basis,default_turnaround_business_days,configuration_metadata,compatibility_metadata,metadata)
SELECT tenants.id,templates.sku,templates.product_name,templates.category_code,templates.restoration_subtype,templates.department,templates.accounting_category,'taxable','standard',templates.category_code,templates.family_code,templates.description,templates.pricing_basis,templates.default_turnaround_business_days,templates.configuration_metadata,templates.compatibility_metadata,jsonb_build_object('templateSku',templates.sku,'ownerApprovedTemplate',true)
FROM tenants CROSS JOIN product_catalog_templates templates
ON CONFLICT (tenant_id,sku) DO NOTHING;

CREATE TABLE product_price_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  product_id uuid NOT NULL,
  practice_id uuid REFERENCES practices(id),
  pricing_basis text NOT NULL CHECK (pricing_basis IN ('PER_UNIT','PER_TOOTH','PER_PRODUCT','PER_ARCH','PER_CASE','PER_COMPONENT','PER_STAGE','QUANTITY_BASED')),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  active boolean NOT NULL DEFAULT true,
  version_note text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_until IS NULL OR effective_until > effective_from),
  UNIQUE (tenant_id,id),
  FOREIGN KEY (tenant_id,product_id) REFERENCES product_catalog(tenant_id,id)
);
CREATE INDEX product_price_versions_lookup_idx ON product_price_versions(tenant_id,product_id,practice_id,effective_from DESC) WHERE active=true;

CREATE FUNCTION enforce_product_price_version_period() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM product_catalog WHERE tenant_id=NEW.tenant_id AND id=NEW.product_id AND pricing_basis=NEW.pricing_basis) THEN
    RAISE EXCEPTION 'Product price basis must match its tenant-owned product.';
  END IF;
  IF NEW.active AND EXISTS (
    SELECT 1 FROM product_price_versions existing
    WHERE existing.tenant_id=NEW.tenant_id AND existing.product_id=NEW.product_id
      AND existing.practice_id IS NOT DISTINCT FROM NEW.practice_id AND existing.active
      AND existing.id<>NEW.id
      AND existing.effective_from<COALESCE(NEW.effective_until,'infinity'::timestamptz)
      AND COALESCE(existing.effective_until,'infinity'::timestamptz)>NEW.effective_from
  ) THEN
    RAISE EXCEPTION 'Active product price versions may not overlap.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER product_price_versions_period_guard BEFORE INSERT OR UPDATE ON product_price_versions FOR EACH ROW EXECUTE FUNCTION enforce_product_price_version_period();

CREATE TABLE product_compatibility_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  source_product_id uuid NOT NULL,
  target_product_id uuid,
  rule_type text NOT NULL CHECK (rule_type IN ('ALLOWED','BLOCKED','REQUIRES_COMPANION','MUTUALLY_EXCLUSIVE')),
  minimum_quantity numeric(10,2),
  maximum_quantity numeric(10,2),
  allowed_arches text[] NOT NULL DEFAULT '{}',
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (minimum_quantity IS NULL OR minimum_quantity > 0),
  CHECK (maximum_quantity IS NULL OR maximum_quantity > 0),
  CHECK (minimum_quantity IS NULL OR maximum_quantity IS NULL OR maximum_quantity >= minimum_quantity),
  UNIQUE (tenant_id,id),
  FOREIGN KEY (tenant_id,source_product_id) REFERENCES product_catalog(tenant_id,id),
  FOREIGN KEY (tenant_id,target_product_id) REFERENCES product_catalog(tenant_id,id)
);
CREATE INDEX product_compatibility_active_idx ON product_compatibility_rules(tenant_id,source_product_id,target_product_id) WHERE active=true;

CREATE TABLE tenant_business_closure_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  closure_date date NOT NULL,
  label text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,closure_date)
);

CREATE TABLE case_product_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  case_id uuid NOT NULL,
  product_id uuid NOT NULL,
  price_version_id uuid NOT NULL,
  line_number integer NOT NULL CHECK (line_number > 0),
  state text NOT NULL DEFAULT 'ACTIVE' CHECK (state IN ('ACTIVE','CANCELLED','FINANCIALLY_COMMITTED')),
  category_code text NOT NULL CHECK (category_code IN ('FIX','REM','IMP','ORT','SLP','DIA','SPL','AUX')),
  product_sku_snapshot text NOT NULL,
  product_name_snapshot text NOT NULL,
  description_snapshot text NOT NULL,
  pricing_basis_snapshot text NOT NULL CHECK (pricing_basis_snapshot IN ('PER_UNIT','PER_TOOTH','PER_PRODUCT','PER_ARCH','PER_CASE','PER_COMPONENT','PER_STAGE','QUANTITY_BASED')),
  unit_price_snapshot numeric(14,2) NOT NULL CHECK (unit_price_snapshot >= 0),
  quantity numeric(10,2) NOT NULL CHECK (quantity > 0),
  line_total numeric(14,2) NOT NULL CHECK (line_total >= 0),
  arch text,
  tooth_numbers integer[] NOT NULL DEFAULT '{}',
  unit_count numeric(10,2),
  stage_count numeric(10,2),
  component_count numeric(10,2),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  turnaround_business_days integer,
  notes text NOT NULL DEFAULT '',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  cancelled_by text,
  UNIQUE (tenant_id,id),
  UNIQUE (tenant_id,case_id,line_number),
  FOREIGN KEY (tenant_id,case_id) REFERENCES clinical_cases(tenant_id,id),
  FOREIGN KEY (tenant_id,product_id) REFERENCES product_catalog(tenant_id,id),
  FOREIGN KEY (tenant_id,price_version_id) REFERENCES product_price_versions(tenant_id,id)
);
CREATE INDEX case_product_lines_case_idx ON case_product_lines(tenant_id,case_id,line_number) WHERE state <> 'CANCELLED';

CREATE TABLE case_product_line_lineage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  case_product_line_id uuid NOT NULL,
  downstream_domain text NOT NULL CHECK (downstream_domain IN ('PRODUCTION','QC','SHIPPING','BILLING','ANALYTICS','GVM','DESIGN_STUDIO')),
  downstream_reference_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,case_product_line_id,downstream_domain,downstream_reference_id),
  FOREIGN KEY (tenant_id,case_product_line_id) REFERENCES case_product_lines(tenant_id,id)
);

CREATE TABLE case_product_tat_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  case_id uuid NOT NULL,
  revised_due_date date NOT NULL,
  reason text NOT NULL,
  authorized_by text NOT NULL,
  authorized_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  FOREIGN KEY (tenant_id,case_id) REFERENCES clinical_cases(tenant_id,id)
);
CREATE UNIQUE INDEX case_product_tat_overrides_one_active_idx ON case_product_tat_overrides(tenant_id,case_id) WHERE active=true;

COMMIT;
