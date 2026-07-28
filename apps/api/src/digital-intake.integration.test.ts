import assert from 'node:assert/strict';
import express from 'express';
import { Pool } from 'pg';
import { PostgresObjectStorage } from './infrastructure/postgres-object-storage.js';
import type { AuditEventInput, AuditRepository } from './infrastructure/contracts.js';
import type { SecurityRequest } from './security.js';
import { installDigitalIntake } from './digital-intake.js';

const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error('DATABASE_URL is required.');
const pool=new Pool({connectionString:databaseUrl});
const tenantId=process.env.NORTHSTAR_TENANT_ID??'00000000-0000-0000-0000-000000000001';
const otherTenant='00000000-0000-0000-0000-000000000002';
const audits:AuditEventInput[]=[];
const audit:AuditRepository={append:async event=>{audits.push(event)},list:async tenant=>audits.filter(item=>item.tenantId===tenant)};

await pool.query(`INSERT INTO tenants(id,name) VALUES($1,'NorthStar Test') ON CONFLICT(id) DO NOTHING`,[tenantId]);
await pool.query(`INSERT INTO tenants(id,name) VALUES($1,'Other Tenant') ON CONFLICT(id) DO NOTHING`,[otherTenant]);
await pool.query('TRUNCATE intake_history,intake_billing_reviews,intake_product_resolutions,intake_routing_resolutions,intake_validations,intake_attachments,digital_prescriptions,intake_submissions,doctor_preference_profiles,product_catalog,scanner_providers RESTART IDENTITY CASCADE');

const app=express();app.use(express.json({limit:'5mb'}));app.use((req:SecurityRequest,_res,next)=>{req.identity={userId:'usr-admin',name:'Dorian Habet',email:'dorianhabet@yahoo.com',role:'system-administrator',tenantId,locationIds:['location-primary'],practiceIds:[],administrativeOverride:true,sessionId:'test-session',csrfToken:'test'};next()});
installDigitalIntake(app,{pool,objects:new PostgresObjectStorage(pool),audit,context:{tenantId,actorId:'usr-admin',actorName:'Dorian Habet'},createOperationalCase:async()=>({id:'case-intake-1',caseNumber:'KDL-INT-1'})});
const server=app.listen(0);await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('Unable to start test server.');const base=`http://127.0.0.1:${address.port}`;
async function request(path:string,method='GET',body?:unknown){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const payload=await response.json().catch(()=>null);return{response,payload}}

try{
 const provider=await request('/api/intake/providers','POST',{providerKey:'manual-upload',displayName:'Manual Upload',providerType:'manual-upload',productionReady:true});assert.equal(provider.response.status,201);
 const submission=await request('/api/intake/submissions','POST',{intakeMethod:'manual-digital',providerKey:'manual-upload',sourceReference:'email-1001',practiceId:'practice-1',doctorId:'doctor-1',patientId:'patient-1'});assert.equal(submission.response.status,201);const submissionId=String(submission.payload.id);assert.equal(submission.payload.status,'prescription-required');
 const premature=await request(`/api/intake/submissions/${submissionId}/accept`,'POST',{});assert.equal(premature.response.status,409,'case cannot bypass mandatory prescription');
 const prescription={practiceId:'practice-1',doctorId:'doctor-1',patientId:'patient-1',patientName:'Test Patient',patientReference:'PAT-1001',shippingLocation:{city:'Northridge'},billingAccount:{accountNumber:'KDL-1001'},contactInformation:{phone:'747-240-4008'},restorations:[{category:'Fixed Restorations',type:'Crown',subtype:'Full Zirconia Crown',material:'Zirconia',toothNumbers:[30],quantity:1}],clinicalInformation:{shade:'A2',stumpShade:'ND2',marginDesign:'Chamfer',contacts:'Normal',occlusion:'Light'},productionNotes:'Verify occlusion.',specialInstructions:'Return with model.'};
 const saved=await request(`/api/intake/submissions/${submissionId}/prescription`,'PUT',prescription);assert.equal(saved.response.status,200);
 const attachment=await request(`/api/intake/submissions/${submissionId}/attachments`,'POST',{fileName:'upper.stl',mimeType:'model/stl',kind:'stl',purpose:'upper-arch',contentBase64:Buffer.from('solid test').toString('base64')});assert.equal(attachment.response.status,201);
 const validation=await request(`/api/intake/submissions/${submissionId}/validate`,'POST',{});assert.equal(validation.response.status,200);assert.equal(validation.payload.status,'complete');
 const route=await request(`/api/intake/submissions/${submissionId}/route`,'POST',{});assert.equal(route.response.status,200);assert.equal(route.payload.route,'internal');assert.equal(route.payload.precedence_source,'tenant-default');
 const products=await request(`/api/intake/submissions/${submissionId}/resolve-products`,'POST',{});assert.equal(products.response.status,200);assert.equal(products.payload.length,1);assert.equal(products.payload[0].sku,'AUTO-FULL-ZIRCONIA-CROWN-ZIRCONIA');assert.equal('default_customer_price' in products.payload[0],false,'submission response must not expose pricing');
 const pdf=await request(`/api/intake/submissions/${submissionId}/prescription-pdf`,'POST',{copy:'production'});assert.equal(pdf.response.status,201);assert.equal(pdf.payload.mimeType,'application/pdf');assert.ok(Buffer.from(pdf.payload.contentBase64,'base64').toString('utf8').startsWith('%PDF-1.4'));
 const accepted=await request(`/api/intake/submissions/${submissionId}/accept`,'POST',{});assert.equal(accepted.response.status,200);assert.equal(accepted.payload.operationalCase.caseNumber,'KDL-INT-1');assert.equal(accepted.payload.billingReview,'pending');
 const review=await request(`/api/intake/submissions/${submissionId}/billing-review`,'POST',{status:'approved',notes:'Products verified.'});assert.equal(review.response.status,200);assert.equal(review.payload.status,'approved');
 const detail=await request(`/api/intake/submissions/${submissionId}`);assert.equal(detail.response.status,200);assert.equal(detail.payload.submission.status,'operational-case-created');assert.ok(detail.payload.history.length>=7);assert.ok(detail.payload.attachments.some((item:{purpose:string})=>item.purpose==='upper-arch'));assert.ok(detail.payload.attachments.some((item:{purpose:string})=>item.purpose==='prescription-production'));assert.equal(detail.payload.products[0].frozen_at!==null,true);
 const objectRows=await pool.query('SELECT owner_type,owner_id,file_name FROM object_records WHERE tenant_id=$1 ORDER BY created_at',[tenantId]);assert.ok(objectRows.rows.some(row=>row.owner_type==='intake-submission'&&row.owner_id===submissionId&&row.file_name==='upper.stl'));assert.ok(objectRows.rows.some(row=>row.owner_type==='digital-prescription'&&row.owner_id===submissionId));
 const notifications=await pool.query('SELECT category FROM communication_notifications WHERE tenant_id=$1',[tenantId]);assert.ok(notifications.rows.some(row=>row.category==='new-submission'));assert.ok(notifications.rows.some(row=>row.category==='billing-review'));
 const communications=await pool.query('SELECT content FROM communication_events WHERE tenant_id=$1 AND entity_id=$2 ORDER BY occurred_at',[tenantId,submissionId]);assert.ok(communications.rows.some(row=>String(row.content).includes('submission received')));assert.ok(communications.rows.some(row=>String(row.content).includes('product resolution completed')));
 await assert.rejects(pool.query(`UPDATE intake_history SET event_type='tampered' WHERE submission_id=$1`,[submissionId]));
 assert.ok(audits.some(item=>item.action==='intake.submission.created'));assert.ok(audits.some(item=>item.action==='intake.prescription.changed'));assert.ok(audits.some(item=>item.action==='intake.submission.accepted'));
 const otherCount=await pool.query('SELECT count(*)::int count FROM intake_submissions WHERE tenant_id=$1',[otherTenant]);assert.equal(otherCount.rows[0]?.count,0);
 console.log('Digital intake integration tests passed.');
}finally{server.close();await pool.end()}
