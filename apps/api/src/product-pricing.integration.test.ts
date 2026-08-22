import assert from 'node:assert/strict';
import express from 'express';
import { Pool } from 'pg';
import type { AuditEventInput, AuditRepository } from './infrastructure/contracts.js';
import { installProductPricing } from './product-pricing.js';
import type { NorthStarRole, SecurityRequest } from './security.js';

const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error('DATABASE_URL is required.');
const pool=new Pool({connectionString:databaseUrl});
const tenantId='00000000-0000-0000-0000-000000000010';
const otherTenant='00000000-0000-0000-0000-000000000011';
const caseId='10000000-0000-0000-0000-000000000001';
const practiceId='20000000-0000-0000-0000-000000000001';
const doctorId='30000000-0000-0000-0000-000000000001';
const patientId='40000000-0000-0000-0000-000000000001';
const audits:AuditEventInput[]=[];
const audit:AuditRepository={append:async event=>{audits.push(event)},list:async tenant=>audits.filter(item=>item.tenantId===tenant)};
let role:NorthStarRole='system-administrator';let platformRole:'none'|'platform-admin'='none';
let activeTenant=tenantId;

await pool.query(`INSERT INTO tenants(id,name) VALUES($1,'PP-1A Tenant'),($2,'Other PP-1A Tenant') ON CONFLICT(id) DO NOTHING`,[tenantId,otherTenant]);
await pool.query('DELETE FROM case_product_tat_overrides WHERE tenant_id IN ($1,$2)',[tenantId,otherTenant]);
await pool.query('DELETE FROM case_product_line_lineage WHERE tenant_id IN ($1,$2)',[tenantId,otherTenant]);
await pool.query('DELETE FROM case_product_lines WHERE tenant_id IN ($1,$2)',[tenantId,otherTenant]);
await pool.query('DELETE FROM tenant_business_closure_days WHERE tenant_id IN ($1,$2)',[tenantId,otherTenant]);
await pool.query('DELETE FROM product_compatibility_rules WHERE tenant_id IN ($1,$2)',[tenantId,otherTenant]);
await pool.query('DELETE FROM product_price_versions WHERE tenant_id IN ($1,$2)',[tenantId,otherTenant]);
await pool.query('DELETE FROM product_catalog WHERE tenant_id IN ($1,$2)',[tenantId,otherTenant]);
await pool.query(`INSERT INTO practices(id,tenant_id,account_number,practice_name,status,phone,email,address,city,state,postal_code,created_at,updated_at) VALUES($1,$2,'PP-1','PP-1 Practice','active','555-0100','pp1@example.test','1 Catalog Way','NorthStar','CA','90001',now(),now()) ON CONFLICT(id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id,deleted_at=NULL`,[practiceId,tenantId]);
await pool.query(`INSERT INTO doctors(id,tenant_id,practice_id,first_name,last_name,email,status,created_at,updated_at) VALUES($1,$2,$3,'Product','Administrator','product.admin@example.test','active',now(),now()) ON CONFLICT(id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id,practice_id=EXCLUDED.practice_id,status='active',deleted_at=NULL`,[doctorId,tenantId,practiceId]);
await pool.query(`INSERT INTO patients(id,tenant_id,practice_id,doctor_id,patient_reference,first_name,last_name,status,created_at,updated_at) VALUES($1,$2,$3,$4,'PP-1','Price','Snapshot','active',now(),now()) ON CONFLICT(id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id,practice_id=EXCLUDED.practice_id,doctor_id=EXCLUDED.doctor_id,deleted_at=NULL`,[patientId,tenantId,practiceId,doctorId]);
await pool.query(`INSERT INTO clinical_cases(id,tenant_id,case_number,patient_id,practice_id,doctor_id,status,arch,restoration,material,shade,rush_priority,received_date,due_date,created_at,updated_at) VALUES($1,$2,'PP-CASE-1',$3,$4,$5,'received','maxillary','Full Zirconia Crown','Zirconia','A2','standard','2026-08-03','2026-08-17',now(),now()) ON CONFLICT(id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id,deleted_at=NULL`,[caseId,tenantId,patientId,practiceId,doctorId]);

const app=express();app.use(express.json());app.use((req:SecurityRequest,_res,next)=>{req.identity={userId:'usr-product-admin',name:'Product Admin',email:'product.admin@example.test',role,tenantId:activeTenant,locationIds:[],practiceIds:[],administrativeOverride:true,sessionId:'product-pricing-test',csrfToken:'test',platformRole};next();});installProductPricing(app,{pool,audit});
const server=app.listen(0);await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('Unable to start product-pricing test server.');const base=`http://127.0.0.1:${address.port}`;
async function request(path:string,method='GET',body?:unknown){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return{response,payload:await response.json().catch(()=>null)}}

try {
  const bootstrap=await request('/api/products/bootstrap-template','POST',{});assert.equal(bootstrap.response.status,201);assert.equal(bootstrap.payload.created,87);
  const fixed=await request('/api/products?category=FIX');assert.equal(fixed.response.status,200);assert.equal(fixed.payload.length,27);assert.ok(fixed.payload.every((item:{categoryCode:string})=>item.categoryCode==='FIX'));
  activeTenant=otherTenant;assert.equal((await request('/api/products/bootstrap-template','POST',{})).response.status,201);const otherFixed=await request('/api/products?category=FIX');const otherZirconia=otherFixed.payload.find((item:{sku:string})=>item.sku==='ZIR-MONO');assert.ok(otherZirconia);activeTenant=tenantId;
  const removable=await request('/api/products?category=REM');assert.equal(removable.payload.length,13);assert.ok(removable.payload.some((item:{sku:string;configuration:Record<string,unknown>})=>item.sku==='PAR-FLP'&&item.configuration.maxTeeth===3));
  const zirconia=fixed.payload.find((item:{sku:string})=>item.sku==='ZIR-MONO');assert.ok(zirconia);
  const today=new Date().toISOString().slice(0,10);const price=await request(`/api/products/${zirconia.id}/prices`,'POST',{pricingBasis:'PER_TOOTH',amount:120,effectiveFrom:'2000-01-01T00:00:00.000Z',versionNote:'Opening price'});assert.equal(price.response.status,201);
  const overlap=await request(`/api/products/${zirconia.id}/prices`,'POST',{pricingBasis:'PER_TOOTH',amount:125,effectiveFrom:'2001-01-01T00:00:00.000Z',effectiveUntil:'2027-01-01T00:00:00.000Z'});assert.equal(overlap.response.status,409);
  const categorySpoof=await request(`/api/cases/${caseId}/product-lines`,'POST',{productId:zirconia.id,categoryCode:'REM',quantity:1,arch:'upper',toothNumbers:[8]});assert.equal(categorySpoof.response.status,409);
  const crossTenant=await request(`/api/cases/${caseId}/product-lines`,'POST',{productId:otherZirconia.id,categoryCode:'FIX',quantity:1,arch:'upper',toothNumbers:[8]});assert.equal(crossTenant.response.status,409);
  const line=await request(`/api/cases/${caseId}/product-lines`,'POST',{productId:zirconia.id,categoryCode:'FIX',quantity:2,arch:'upper',toothNumbers:[8,9],unitCount:2,configuration:{selection:'MULTIPLE_TEETH'}});if(line.response.status!==201)throw new Error(`Unable to create PP-1A case line: ${JSON.stringify(line.payload)}`);assert.equal(Number(line.payload.line.unit_price_snapshot),120);assert.equal(Number(line.payload.line.line_total),240);assert.equal(line.payload.summary.turnaroundBusinessDays,10);assert.equal(line.payload.summary.calculatedDueDate,'2026-08-17');const lineage=await request(`/api/cases/${caseId}/product-lines/${line.payload.line.id}/lineage`);assert.equal(lineage.response.status,200);assert.equal(lineage.payload.line.id,line.payload.line.id);
  const edit=await request(`/api/products/${zirconia.id}`,'PUT',{productName:'Edited tenant zirconia',description:'Tenant-owned product edit',familyCode:'FIX-ZIR'});assert.equal(edit.response.status,200);assert.equal(edit.payload.productName,'Edited tenant zirconia');
  const replacement=await request(`/api/products/${zirconia.id}/prices`,'POST',{pricingBasis:'PER_TOOTH',amount:150,effectiveFrom:`${today}T00:00:00.000Z`,versionNote:'Superseding price'});assert.equal(replacement.response.status,201);const history=await request(`/api/products/${zirconia.id}/prices`);assert.equal(history.payload.length,2);assert.equal(Number(history.payload.find((item:{id:string})=>item.id===price.payload.id).amount),120);
  const stacked=await request(`/api/cases/${caseId}/product-lines`,'POST',{productId:zirconia.id,categoryCode:'FIX',quantity:1,arch:'upper',toothNumbers:[10],unitCount:1,configuration:{selection:'MULTIPLE_TEETH'}});assert.equal(stacked.response.status,201);assert.equal(Number(stacked.payload.line.unit_price_snapshot),150);const lines=await request(`/api/cases/${caseId}/product-lines`);assert.equal(lines.payload.length,2);assert.equal(Number(lines.payload[0].unit_price_snapshot),120);assert.equal(lines.payload[0].product_name_snapshot,'Monolithic Zirconia');assert.equal(lines.payload[0].tooth_numbers[0],8);
  const summary=await request(`/api/cases/${caseId}/product-pricing-summary`);assert.equal(summary.response.status,200);assert.equal(summary.payload.total,390);assert.equal(summary.payload.lineCount,2);
  const closure=await request('/api/product-pricing/closure-days','POST',{closureDate:'2026-08-10',label:'Tenant closure'});assert.equal(closure.response.status,201);const closureSummary=await request(`/api/cases/${caseId}/product-pricing-summary`);assert.equal(closureSummary.payload.calculatedDueDate,'2026-08-18');
  const override=await request(`/api/cases/${caseId}/product-tat-override`,'POST',{revisedDueDate:'2026-08-12',reason:'Owner-approved rush handling'});assert.equal(override.response.status,201);assert.equal((await request(`/api/cases/${caseId}/product-pricing-summary`)).payload.authorizedDueDate,'2026-08-12');
  const otherProduct=await pool.query<{id:string}>('SELECT id FROM product_catalog WHERE tenant_id=$1 AND sku=$2',[tenantId,'ZIR-ESTH']);const otherId=otherProduct.rows[0]!.id;const compatibility=await request(`/api/products/${zirconia.id}/compatibility-rules`,'POST',{targetProductId:otherId,ruleType:'BLOCKED'});assert.equal(compatibility.response.status,201);const incompatible=await request(`/api/cases/${caseId}/product-lines`,'POST',{productId:otherId,categoryCode:'FIX',quantity:1,arch:'upper',toothNumbers:[10]});assert.equal(incompatible.response.status,409);
  const deactivate=await request(`/api/products/${zirconia.id}/lifecycle`,'POST',{active:false});assert.equal(deactivate.response.status,200);const inactiveRejected=await request(`/api/cases/${caseId}/product-lines`,'POST',{productId:zirconia.id,categoryCode:'FIX',quantity:1,arch:'upper',toothNumbers:[11]});assert.equal(inactiveRejected.response.status,409);
  role='read-only-auditor';const denied=await request('/api/products','POST',{sku:'DENIED',productName:'Denied',categoryCode:'FIX',pricingBasis:'PER_PRODUCT'});assert.equal(denied.response.status,403);role='system-administrator';platformRole='platform-admin';const platformDenied=await request('/api/products?category=FIX');assert.equal(platformDenied.response.status,403);platformRole='none';
  const otherCatalog=await pool.query('SELECT count(*)::int count FROM product_catalog WHERE tenant_id=$1',[otherTenant]);assert.equal(otherCatalog.rows[0]?.count,87);assert.ok(audits.some(item=>item.action==='product.price-version.created'));assert.ok(audits.some(item=>item.action==='case.product-line.created'));
  console.log('PP-1A product pricing integration tests passed.');
} finally {server.close();await pool.end();}
