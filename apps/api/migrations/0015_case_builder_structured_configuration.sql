BEGIN;

-- F5 adds tenant-owned navigation and clinical instruction libraries around the
-- authoritative Product Catalog.  Products remain the only billable objects.
CREATE TABLE tenant_restoration_subtypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  category_code text NOT NULL CHECK (category_code IN ('FIX','REM','IMP','ORT','SLP','DIA','SPL','AUX')),
  code text NOT NULL,
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 100,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id),
  UNIQUE(tenant_id,code)
);

CREATE TABLE product_restoration_subtype_mappings (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  product_id uuid NOT NULL,
  subtype_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,product_id,subtype_id),
  FOREIGN KEY(tenant_id,product_id) REFERENCES product_catalog(tenant_id,id),
  FOREIGN KEY(tenant_id,subtype_id) REFERENCES tenant_restoration_subtypes(tenant_id,id)
);
CREATE INDEX product_restoration_subtype_lookup_idx ON product_restoration_subtype_mappings(tenant_id,subtype_id,product_id) WHERE active;

CREATE TABLE tenant_option_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  code text NOT NULL,
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 100,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id),
  UNIQUE(tenant_id,code)
);

CREATE TABLE tenant_option_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  option_set_id uuid NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 100,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id),
  UNIQUE(tenant_id,option_set_id,code),
  FOREIGN KEY(tenant_id,option_set_id) REFERENCES tenant_option_sets(tenant_id,id)
);
CREATE INDEX tenant_option_values_lookup_idx ON tenant_option_values(tenant_id,option_set_id,display_order,code) WHERE active;

CREATE TABLE product_configuration_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  product_id uuid NOT NULL,
  field_key text NOT NULL,
  label text NOT NULL,
  option_set_id uuid,
  requirement_state text NOT NULL CHECK (requirement_state IN ('REQUIRED','OPTIONAL','HIDDEN')),
  allow_custom boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 100,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id),
  UNIQUE(tenant_id,product_id,field_key),
  FOREIGN KEY(tenant_id,product_id) REFERENCES product_catalog(tenant_id,id),
  FOREIGN KEY(tenant_id,option_set_id) REFERENCES tenant_option_sets(tenant_id,id)
);
CREATE INDEX product_configuration_requirements_lookup_idx ON product_configuration_requirements(tenant_id,product_id,display_order);

-- Seed a reusable library for every existing tenant.  The same explicit codes
-- preserve historic Case Product Line snapshots even when labels later change.
WITH sets(code,label,display_order) AS (VALUES
 ('SHADE_SYSTEM','Shade system',10),('SHADE','Shade',20),('STUMP_SHADE','IPS Natural Die stump / preparation shade',30),
 ('MARGIN_STANDARD','Margin design',40),('MARGIN_PFM','PFM margin design',50),('CEMENT_PROTOCOL','Cement / bonding instruction',60),
 ('REQUIREMENT_STATUS','Supporting record status',70)
)
INSERT INTO tenant_option_sets(tenant_id,code,label,display_order)
SELECT tenant.id,sets.code,sets.label,sets.display_order FROM tenants tenant CROSS JOIN sets
ON CONFLICT(tenant_id,code) DO NOTHING;

WITH valueset(set_code,code,label,display_order,metadata) AS (VALUES
 ('SHADE_SYSTEM','VITA_CLASSICAL','VITA Classical A1–D4',10,'{}'::jsonb),('SHADE_SYSTEM','BLEACHED','Bleached shades',20,'{}'::jsonb),
 ('SHADE','A1','A1',10,'{"shadeSystem":"VITA_CLASSICAL"}'::jsonb),('SHADE','A2','A2',20,'{"shadeSystem":"VITA_CLASSICAL"}'::jsonb),('SHADE','A3','A3',30,'{"shadeSystem":"VITA_CLASSICAL"}'::jsonb),('SHADE','A3_5','A3.5',40,'{"shadeSystem":"VITA_CLASSICAL"}'::jsonb),('SHADE','A4','A4',50,'{"shadeSystem":"VITA_CLASSICAL"}'::jsonb),
 ('SHADE','B1','B1',60,'{"shadeSystem":"VITA_CLASSICAL"}'::jsonb),('SHADE','B2','B2',70,'{"shadeSystem":"VITA_CLASSICAL"}'::jsonb),('SHADE','B3','B3',80,'{"shadeSystem":"VITA_CLASSICAL"}'::jsonb),('SHADE','B4','B4',90,'{"shadeSystem":"VITA_CLASSICAL"}'::jsonb),
 ('SHADE','C1','C1',100,'{"shadeSystem":"VITA_CLASSICAL"}'::jsonb),('SHADE','C2','C2',110,'{"shadeSystem":"VITA_CLASSICAL"}'::jsonb),('SHADE','C3','C3',120,'{"shadeSystem":"VITA_CLASSICAL"}'::jsonb),('SHADE','C4','C4',130,'{"shadeSystem":"VITA_CLASSICAL"}'::jsonb),
 ('SHADE','D2','D2',140,'{"shadeSystem":"VITA_CLASSICAL"}'::jsonb),('SHADE','D3','D3',150,'{"shadeSystem":"VITA_CLASSICAL"}'::jsonb),('SHADE','D4','D4',160,'{"shadeSystem":"VITA_CLASSICAL"}'::jsonb),
 ('SHADE','0M1','0M1',170,'{"shadeSystem":"BLEACHED"}'::jsonb),('SHADE','0M2','0M2',180,'{"shadeSystem":"BLEACHED"}'::jsonb),('SHADE','0M3','0M3',190,'{"shadeSystem":"BLEACHED"}'::jsonb),
 ('SHADE','CUSTOM_SHADE','Custom shade',200,'{}'::jsonb),('SHADE','SHADE_PHOTO_ATTACHED','Shade photo attached',210,'{}'::jsonb),('SHADE','SHADE_APPOINTMENT_REQUIRED','Shade appointment required',220,'{}'::jsonb),('SHADE','NOT_APPLICABLE','Not applicable',230,'{}'::jsonb),
 ('STUMP_SHADE','ND1','ND1',10,'{}'::jsonb),('STUMP_SHADE','ND2','ND2',20,'{}'::jsonb),('STUMP_SHADE','ND3','ND3',30,'{}'::jsonb),('STUMP_SHADE','ND4','ND4',40,'{}'::jsonb),('STUMP_SHADE','ND5','ND5',50,'{}'::jsonb),('STUMP_SHADE','ND6','ND6',60,'{}'::jsonb),('STUMP_SHADE','ND7','ND7',70,'{}'::jsonb),('STUMP_SHADE','ND8','ND8',80,'{}'::jsonb),('STUMP_SHADE','ND9','ND9',90,'{}'::jsonb),('STUMP_SHADE','CUSTOM','Custom',100,'{}'::jsonb),('STUMP_SHADE','PHOTO_ATTACHED','Photo attached',110,'{}'::jsonb),('STUMP_SHADE','NOT_PROVIDED','Not provided',120,'{}'::jsonb),('STUMP_SHADE','NOT_APPLICABLE','Not applicable',130,'{}'::jsonb),
 ('MARGIN_STANDARD','CHAMFER','Chamfer',10,'{}'::jsonb),('MARGIN_STANDARD','DEEP_CHAMFER','Deep chamfer',20,'{}'::jsonb),('MARGIN_STANDARD','SHOULDER','Shoulder',30,'{}'::jsonb),('MARGIN_STANDARD','ROUNDED_SHOULDER','Rounded shoulder',40,'{}'::jsonb),('MARGIN_STANDARD','BEVELED_SHOULDER','Beveled shoulder',50,'{}'::jsonb),('MARGIN_STANDARD','KNIFE_EDGE','Knife edge / feather edge',60,'{}'::jsonb),('MARGIN_STANDARD','BUTT_JOINT','Butt joint',70,'{}'::jsonb),('MARGIN_STANDARD','OTHER_CUSTOM','Other / custom',80,'{}'::jsonb),('MARGIN_STANDARD','DOCTOR_SPECIFIED','Doctor specified',90,'{}'::jsonb),('MARGIN_STANDARD','FOLLOW_EXISTING','Follow existing preparation',100,'{}'::jsonb),('MARGIN_STANDARD','REQUIRES_REVIEW','Requires review',110,'{}'::jsonb),
 ('MARGIN_PFM','CHAMFER','Chamfer',10,'{}'::jsonb),('MARGIN_PFM','DEEP_CHAMFER','Deep chamfer',20,'{}'::jsonb),('MARGIN_PFM','SHOULDER','Shoulder',30,'{}'::jsonb),('MARGIN_PFM','ROUNDED_SHOULDER','Rounded shoulder',40,'{}'::jsonb),('MARGIN_PFM','PORCELAIN_MARGIN','Collarless / porcelain margin',50,'{}'::jsonb),('MARGIN_PFM','METAL_COLLAR','Metal collar',60,'{}'::jsonb),('MARGIN_PFM','OTHER_CUSTOM','Other / custom',70,'{}'::jsonb),('MARGIN_PFM','DOCTOR_SPECIFIED','Doctor specified',80,'{}'::jsonb),('MARGIN_PFM','FOLLOW_EXISTING','Follow existing preparation',90,'{}'::jsonb),('MARGIN_PFM','REQUIRES_REVIEW','Requires review',100,'{}'::jsonb),
 ('CEMENT_PROTOCOL','DOCTOR_TO_CEMENT','Doctor to cement',10,'{}'::jsonb),('CEMENT_PROTOCOL','LABORATORY_CEMENTATION','Laboratory cementation',20,'{}'::jsonb),('CEMENT_PROTOCOL','CONVENTIONAL','Conventional cementation',30,'{}'::jsonb),('CEMENT_PROTOCOL','RMGI','Resin-modified glass ionomer',40,'{}'::jsonb),('CEMENT_PROTOCOL','SELF_ADHESIVE_RESIN','Self-adhesive resin cement',50,'{}'::jsonb),('CEMENT_PROTOCOL','ADHESIVE_RESIN','Adhesive resin cement',60,'{}'::jsonb),('CEMENT_PROTOCOL','PROVISIONAL','Provisional cement',70,'{}'::jsonb),('CEMENT_PROTOCOL','MANUFACTURER_PROTOCOL','Manufacturer-specific protocol',80,'{}'::jsonb),('CEMENT_PROTOCOL','NOT_APPLICABLE','Not applicable',90,'{}'::jsonb),('CEMENT_PROTOCOL','OTHER_CUSTOM','Other / custom',100,'{}'::jsonb),
 ('REQUIREMENT_STATUS','PROVIDED','Provided / received',10,'{}'::jsonb),('REQUIREMENT_STATUS','MISSING','Missing',20,'{}'::jsonb),('REQUIREMENT_STATUS','REQUESTED','Requested',30,'{}'::jsonb),('REQUIREMENT_STATUS','TO_FOLLOW','To follow',40,'{}'::jsonb),('REQUIREMENT_STATUS','NOT_APPLICABLE','Not applicable',50,'{}'::jsonb)
)
INSERT INTO tenant_option_values(tenant_id,option_set_id,code,label,display_order,metadata)
SELECT sets.tenant_id,sets.id,valueset.code,valueset.label,valueset.display_order,valueset.metadata
FROM tenant_option_sets sets JOIN valueset ON valueset.set_code=sets.code
ON CONFLICT(tenant_id,option_set_id,code) DO NOTHING;

WITH catalog AS (
 SELECT product.tenant_id,product.id product_id,product.category_code,
   CASE WHEN product.category_code='FIX' AND product.family_code='FIX-BRG' THEN 'MULTI_UNIT_BRIDGE'
        WHEN product.category_code='FIX' AND product.family_code='FIX-ION' THEN 'INLAY_ONLAY'
        WHEN product.category_code='FIX' AND product.family_code='FIX-VNR' THEN 'VENEER'
        WHEN product.category_code='FIX' THEN 'SINGLE_CROWN'
        ELSE regexp_replace(upper(coalesce(product.restoration_subtype,product.product_name)),'[^A-Z0-9]+','_','g') END subtype_code,
   CASE WHEN product.category_code='FIX' AND product.family_code='FIX-BRG' THEN 'Multi-Unit Bridge'
        WHEN product.category_code='FIX' AND product.family_code='FIX-ION' THEN 'Inlay / Onlay'
        WHEN product.category_code='FIX' AND product.family_code='FIX-VNR' THEN 'Veneer'
        WHEN product.category_code='FIX' THEN 'Single Crown'
        ELSE coalesce(product.restoration_subtype,product.product_name) END subtype_label
 FROM product_catalog product WHERE product.category_code IS NOT NULL
), distinct_subtypes AS (
 SELECT DISTINCT tenant_id,category_code,category_code||'-'||subtype_code code,subtype_label label FROM catalog
)
INSERT INTO tenant_restoration_subtypes(tenant_id,category_code,code,label)
SELECT tenant_id,category_code,code,label FROM distinct_subtypes
ON CONFLICT(tenant_id,code) DO NOTHING;

WITH catalog AS (
 SELECT product.tenant_id,product.id product_id,product.category_code,
   CASE WHEN product.category_code='FIX' AND product.family_code='FIX-BRG' THEN 'MULTI_UNIT_BRIDGE'
        WHEN product.category_code='FIX' AND product.family_code='FIX-ION' THEN 'INLAY_ONLAY'
        WHEN product.category_code='FIX' AND product.family_code='FIX-VNR' THEN 'VENEER'
        WHEN product.category_code='FIX' THEN 'SINGLE_CROWN'
        ELSE regexp_replace(upper(coalesce(product.restoration_subtype,product.product_name)),'[^A-Z0-9]+','_','g') END subtype_code
 FROM product_catalog product WHERE product.category_code IS NOT NULL
)
INSERT INTO product_restoration_subtype_mappings(tenant_id,product_id,subtype_id)
SELECT catalog.tenant_id,catalog.product_id,subtype.id FROM catalog
JOIN tenant_restoration_subtypes subtype ON subtype.tenant_id=catalog.tenant_id AND subtype.code=catalog.category_code||'-'||catalog.subtype_code
ON CONFLICT DO NOTHING;

-- Fixed products receive the clinically structured baseline.  Tenant administrators
-- can add, hide, reorder, or replace these mappings per product without changing
-- the product, its SKU, price versions, or historical Case Product Lines.
INSERT INTO product_configuration_requirements(tenant_id,product_id,field_key,label,option_set_id,requirement_state,allow_custom,display_order)
SELECT product.tenant_id,product.id,seed.field_key,seed.label,option_set.id,seed.requirement_state,seed.allow_custom,seed.display_order
FROM product_catalog product
JOIN LATERAL (VALUES
 ('shadeSystem','Shade system','SHADE_SYSTEM','REQUIRED',false,10),
 ('shade','Shade','SHADE','REQUIRED',true,20),
 ('marginDesign','Margin design',CASE WHEN product.family_code='FIX-PFM' THEN 'MARGIN_PFM' ELSE 'MARGIN_STANDARD' END,'REQUIRED',true,30),
 ('cementProtocol','Cement / bonding instruction','CEMENT_PROTOCOL','OPTIONAL',true,40),
 ('prepProvided','Prep scan provided','REQUIREMENT_STATUS','REQUIRED',false,50),
 ('opposingProvided','Opposing provided','REQUIREMENT_STATUS','REQUIRED',false,60),
 ('biteProvided','Bite provided','REQUIREMENT_STATUS','REQUIRED',false,70)
) AS seed(field_key,label,set_code,requirement_state,allow_custom,display_order) ON product.category_code='FIX'
JOIN tenant_option_sets option_set ON option_set.tenant_id=product.tenant_id AND option_set.code=seed.set_code
ON CONFLICT(tenant_id,product_id,field_key) DO NOTHING;

INSERT INTO product_configuration_requirements(tenant_id,product_id,field_key,label,option_set_id,requirement_state,allow_custom,display_order)
SELECT product.tenant_id,product.id,'stumpShade','Stump shade',option_set.id,'OPTIONAL',true,25
FROM product_catalog product JOIN tenant_option_sets option_set ON option_set.tenant_id=product.tenant_id AND option_set.code='STUMP_SHADE'
WHERE product.category_code='FIX' AND (product.family_code IN ('FIX-VNR','FIX-PFZ') OR product.sku='CRN-EMX')
ON CONFLICT(tenant_id,product_id,field_key) DO NOTHING;

-- New tenant products immediately receive a subtype navigation mapping.  Product
-- administration can later change the mapping without creating a second catalog.
CREATE FUNCTION sync_product_restoration_subtype_mapping() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE subtype_code text; subtype_label text; subtype_id uuid;
BEGIN
  IF NEW.category_code IS NULL THEN RETURN NEW; END IF;
  IF NEW.category_code='FIX' AND NEW.family_code='FIX-BRG' THEN subtype_code:='MULTI_UNIT_BRIDGE'; subtype_label:='Multi-Unit Bridge';
  ELSIF NEW.category_code='FIX' AND NEW.family_code='FIX-ION' THEN subtype_code:='INLAY_ONLAY'; subtype_label:='Inlay / Onlay';
  ELSIF NEW.category_code='FIX' AND NEW.family_code='FIX-VNR' THEN subtype_code:='VENEER'; subtype_label:='Veneer';
  ELSIF NEW.category_code='FIX' THEN subtype_code:='SINGLE_CROWN'; subtype_label:='Single Crown';
  ELSE subtype_code:=regexp_replace(upper(coalesce(NEW.restoration_subtype,NEW.product_name)),'[^A-Z0-9]+','_','g'); subtype_label:=coalesce(NEW.restoration_subtype,NEW.product_name); END IF;
  INSERT INTO tenant_restoration_subtypes(tenant_id,category_code,code,label,created_by)
  VALUES(NEW.tenant_id,NEW.category_code,NEW.category_code||'-'||subtype_code,subtype_label,'system')
  ON CONFLICT(tenant_id,code) DO NOTHING;
  SELECT id INTO subtype_id FROM tenant_restoration_subtypes WHERE tenant_id=NEW.tenant_id AND code=NEW.category_code||'-'||subtype_code;
  INSERT INTO product_restoration_subtype_mappings(tenant_id,product_id,subtype_id)
  VALUES(NEW.tenant_id,NEW.id,subtype_id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER product_catalog_subtype_mapping AFTER INSERT ON product_catalog FOR EACH ROW EXECUTE FUNCTION sync_product_restoration_subtype_mapping();

COMMIT;
