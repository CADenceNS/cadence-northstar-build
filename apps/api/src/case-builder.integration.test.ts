import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { prepareCaseProductLines, savePreparedCaseProductLines } from './case-builder.js';

const connectionString=process.env.DATABASE_URL;
if(!connectionString)throw new Error('DATABASE_URL is required.');
const pool=new Pool({connectionString});
const tenantId='00000000-0000-0000-0000-000000000016';
const otherTenantId='00000000-0000-0000-0000-000000000017';
const practiceId='00000000-0000-0000-0000-000000000116';
const caseId=randomUUID();

async function catalogProduct(tenant:string,sku:string){const result=await pool.query<{id:string;category_code:string}>('SELECT id,category_code FROM product_catalog WHERE tenant_id=$1 AND sku=$2',[tenant,sku]);assert.ok(result.rows[0],`Missing catalog product ${sku}.`);return result.rows[0]!;}

try{
  await pool.query(`INSERT INTO tenants(id,name) VALUES($1,'Case Builder Tenant'),($2,'Other Case Builder Tenant') ON CONFLICT(id) DO UPDATE SET deleted_at=NULL`,[tenantId,otherTenantId]);
  for(const tenant of [tenantId,otherTenantId])await pool.query(`INSERT INTO product_catalog(tenant_id,sku,product_name,restoration_category,restoration_subtype,material,department,accounting_category,tax_status,turnaround_category,category_code,family_code,description,pricing_basis,default_turnaround_business_days,configuration_metadata,compatibility_metadata,metadata) SELECT $1,sku,product_name,category_code,restoration_subtype,NULL,department,accounting_category,'taxable','standard',category_code,family_code,description,pricing_basis,default_turnaround_business_days,configuration_metadata,compatibility_metadata,jsonb_build_object('test','case-builder') FROM product_catalog_templates ON CONFLICT(tenant_id,sku) DO NOTHING`,[tenant]);
  await pool.query('DELETE FROM case_product_line_lineage WHERE tenant_id=$1',[tenantId]);
  await pool.query('DELETE FROM case_product_lines WHERE tenant_id=$1',[tenantId]);
  await pool.query('DELETE FROM product_compatibility_rules WHERE tenant_id=$1',[tenantId]);
  await pool.query('DELETE FROM product_price_versions WHERE tenant_id=$1',[tenantId]);
  await pool.query('DELETE FROM tenant_business_closure_days WHERE tenant_id=$1',[tenantId]);
  const zirconia=await catalogProduct(tenantId,'ZIR-MONO'),unpriced=await catalogProduct(tenantId,'ZIR-ESTH'),denture=await catalogProduct(tenantId,'DEN-PREM'),abutment=await catalogProduct(tenantId,'ABT-TI'),otherZirconia=await catalogProduct(otherTenantId,'ZIR-MONO');
  for(const [product,amount] of [[zirconia,'99.00'],[denture,'850.00'],[abutment,'125.00']] as const)await pool.query('INSERT INTO product_price_versions(tenant_id,product_id,pricing_basis,amount,effective_from,created_by) SELECT $1,$2,pricing_basis,$3,\'2000-01-01\',$4 FROM product_catalog WHERE tenant_id=$1 AND id=$2',[tenantId,product.id,amount,'case-builder-test']);
  await pool.query('INSERT INTO tenant_business_closure_days(tenant_id,closure_date,label,created_by) VALUES($1,\'2026-08-10\',\'Tenant closure\',\'case-builder-test\')',[tenantId]);
  const fixed=await prepareCaseProductLines(pool,tenantId,{practiceId,receivedDate:'2026-08-07',productLines:[{productId:zirconia.id,categoryCode:'FIX',quantity:1,arch:'upper',toothNumbers:[8],configuration:{shade:'A2'}}]});
  await assert.rejects(prepareCaseProductLines(pool,tenantId,{practiceId,receivedDate:'2026-08-07',productLines:[{productId:unpriced.id,categoryCode:'FIX',quantity:1,arch:'upper',toothNumbers:[8]}]}),/PRICE NOT CONFIGURED/);
  assert.equal(fixed.lines[0]?.unitPrice,99);assert.equal(fixed.lines[0]?.lineTotal,99);assert.equal(fixed.lines[0]?.familyCode,'FIX-ZIR');assert.equal(fixed.turnaroundBusinessDays,10);assert.equal(fixed.calculatedDueDate,'2026-08-24');
  const removable=await prepareCaseProductLines(pool,tenantId,{practiceId,receivedDate:'2026-08-07',productLines:[{productId:denture.id,categoryCode:'REM',quantity:1,arch:'both',configuration:{toothShadeMold:'A2'}},{productId:abutment.id,categoryCode:'IMP',quantity:1,arch:'upper',toothNumbers:[8],configuration:{implantSystem:'Megagen'}}]});
  assert.equal(removable.lines.length,2);assert.equal(removable.subtotal,975);assert.equal(removable.turnaroundBusinessDays,14);assert.equal(removable.calculatedDueDate,'2026-08-28');
  await assert.rejects(prepareCaseProductLines(pool,tenantId,{practiceId,receivedDate:'2026-08-07',productLines:[{productId:zirconia.id,categoryCode:'REM',quantity:1,arch:'upper',toothNumbers:[8]}]}),/selected restoration category/);
  await assert.rejects(prepareCaseProductLines(pool,tenantId,{practiceId,receivedDate:'2026-08-07',productLines:[{productId:otherZirconia.id,categoryCode:'FIX',quantity:1,arch:'upper',toothNumbers:[8]}]}),/Active product not found/);
  await pool.query('INSERT INTO product_compatibility_rules(tenant_id,source_product_id,target_product_id,rule_type,created_by) VALUES($1,$2,$3,\'BLOCKED\',\'case-builder-test\')',[tenantId,zirconia.id,denture.id]);
  await assert.rejects(prepareCaseProductLines(pool,tenantId,{practiceId,receivedDate:'2026-08-07',productLines:[{productId:zirconia.id,categoryCode:'FIX',quantity:1,arch:'upper',toothNumbers:[8]},{productId:denture.id,categoryCode:'REM',quantity:1,arch:'upper'}]}),/incompatible product stack/);
  const client=await pool.connect();try{await client.query('BEGIN');await client.query("INSERT INTO repository_documents(tenant_id,entity_type,entity_id,payload) VALUES($1,'case',$2,$3::jsonb)",[tenantId,caseId,JSON.stringify({id:caseId,practiceId,receivedDate:'2026-08-07'})]);await savePreparedCaseProductLines(client,tenantId,caseId,fixed.lines,'case-builder-test');await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  const saved=await pool.query<{product_sku_snapshot:string;family_code_snapshot:string;unit_price_snapshot:string;turnaround_business_days:number}>('SELECT product_sku_snapshot,family_code_snapshot,unit_price_snapshot,turnaround_business_days FROM case_product_lines WHERE tenant_id=$1 AND case_id=$2',[tenantId,caseId]);assert.deepEqual(saved.rows[0],{product_sku_snapshot:'ZIR-MONO',family_code_snapshot:'FIX-ZIR',unit_price_snapshot:'99.00',turnaround_business_days:10});
  await pool.query('UPDATE product_catalog SET active=false WHERE tenant_id=$1 AND id=$2',[tenantId,zirconia.id]);
  await assert.rejects(prepareCaseProductLines(pool,tenantId,{practiceId,receivedDate:'2026-08-07',productLines:[{productId:zirconia.id,categoryCode:'FIX',quantity:1,arch:'upper',toothNumbers:[8]}]}),/Active product not found/);
  console.log('PP-1B-F2A1 Case Builder integration tests passed.');
}finally{try{await pool.query('DELETE FROM case_product_line_lineage WHERE tenant_id=$1',[tenantId]);await pool.query('DELETE FROM case_product_lines WHERE tenant_id=$1 AND case_id=$2',[tenantId,caseId]);await pool.query('DELETE FROM case_product_tat_overrides WHERE tenant_id=$1 AND case_id=$2',[tenantId,caseId]);await pool.query(`DELETE FROM case_product_line_case_entities WHERE tenant_id=$1 AND case_entity_type='case' AND case_id=$2`,[tenantId,caseId]);await pool.query(`DELETE FROM repository_documents WHERE tenant_id=$1 AND entity_type='case' AND entity_id=$2`,[tenantId,caseId]);}finally{await pool.end();}}
