BEGIN;
DROP TABLE IF EXISTS case_product_tat_overrides;
DROP TABLE IF EXISTS case_product_line_lineage;
DROP TABLE IF EXISTS case_product_lines;
DROP TABLE IF EXISTS tenant_business_closure_days;
DROP TABLE IF EXISTS product_compatibility_rules;
DROP TABLE IF EXISTS product_price_versions;
DROP FUNCTION IF EXISTS enforce_product_price_version_period();
DROP TABLE IF EXISTS product_catalog_templates;
ALTER TABLE product_catalog
  DROP CONSTRAINT IF EXISTS product_catalog_category_code_check,
  DROP CONSTRAINT IF EXISTS product_catalog_pricing_basis_check,
  DROP CONSTRAINT IF EXISTS product_catalog_turnaround_check,
  DROP CONSTRAINT IF EXISTS product_catalog_tenant_id_unique,
  DROP COLUMN IF EXISTS category_code,
  DROP COLUMN IF EXISTS family_code,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS pricing_basis,
  DROP COLUMN IF EXISTS default_turnaround_business_days,
  DROP COLUMN IF EXISTS configuration_metadata,
  DROP COLUMN IF EXISTS compatibility_metadata,
  DROP COLUMN IF EXISTS archived_at;
ALTER TABLE clinical_cases DROP CONSTRAINT IF EXISTS clinical_cases_tenant_id_unique;
COMMIT;
