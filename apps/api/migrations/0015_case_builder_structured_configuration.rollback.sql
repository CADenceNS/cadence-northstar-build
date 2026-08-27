BEGIN;
DROP TRIGGER IF EXISTS product_catalog_subtype_mapping ON product_catalog;
DROP FUNCTION IF EXISTS sync_product_restoration_subtype_mapping();
DROP TABLE IF EXISTS product_configuration_requirements;
DROP TABLE IF EXISTS tenant_option_values;
DROP TABLE IF EXISTS tenant_option_sets;
DROP TABLE IF EXISTS product_restoration_subtype_mappings;
DROP TABLE IF EXISTS tenant_restoration_subtypes;
COMMIT;
