import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PostgresObjectStorage } from './infrastructure/postgres-object-storage.js';
import { initializeCaseOperationsWithClient, installCaseOperations } from './case-operations.js';

const connectionString=process.env.DATABASE_URL;
if(!connectionString)throw new Error('DATABASE_URL is required.');
const pool=new Pool({connectionString});
const tenantId='00000000-0000-0000-0000-000000000026';
const otherTenantId='00000000-0000-0000-0000-000000000027';
const caseId=randomUUID(),otherCaseId=randomUUID();
const context={tenantId,actorId:'case-operations-test',actorName:'Case Operations Test'};
const objects=new PostgresObjectStorage(pool);

await pool.query(`INSERT INTO tenants(id,name) VALUES($1,'Case Operations Tenant'),($2,'Other Case Operations Tenant') ON CONFLICT(id) DO UPDATE SET deleted_at=NULL`,[tenantId,otherTenantId]);
await pool.query(`INSERT INTO repository_documents(tenant_id,entity_type,entity_id,payload) VALUES($1,'case',$2,'{}'),($3,'case',$4,'{}') ON CONFLICT(tenant_id,entity_type,entity_id) DO UPDATE SET deleted_at=NULL`,[tenantId,caseId,otherTenantId,otherCaseId]);
await pool.query(`INSERT INTO tenant_case_hold_reasons(tenant_id,code,category,label,pauses_tat,created_by) VALUES($1,'TEST-PAUSE','TEST','Test pause',true,'test') ON CONFLICT(tenant_id,code) DO UPDATE SET active=true`,[tenantId]);
await pool.query(`INSERT INTO tenant_case_cancellation_reasons(tenant_id,code,category,label,created_by) VALUES($1,'TEST-CANCEL','TEST','Test cancel','test') ON CONFLICT(tenant_id,code) DO UPDATE SET active=true`,[tenantId]);
const client=await pool.connect();try{await client.query('BEGIN');await initializeCaseOperationsWithClient(client,context,caseId,'DIGITAL','2026-08-21');await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}

const digitalSubmission=randomUUID(),physicalSubmission=randomUUID(),otherSubmission=randomUUID();
const digitalObject=await objects.put({tenantId,ownerType:'intake-submission',ownerId:digitalSubmission,kind:'stl',fileName:'prep.stl',mimeType:'model/stl',bytes:Buffer.from('prep-scan')});
await pool.query(`INSERT INTO intake_submissions(id,tenant_id,submission_number,intake_method,source_reference,status,created_by) VALUES($1,$2,'INT-TEST-DIGITAL','manual-digital','email-test','received','test'),($3,$2,'INT-TEST-PHYSICAL','physical','courier-test','received','test'),($4,$5,'INT-TEST-OTHER','physical','other-tenant','received','test')`,[digitalSubmission,tenantId,physicalSubmission,otherSubmission,otherTenantId]);
await pool.query(`INSERT INTO intake_attachments(tenant_id,submission_id,object_id,purpose) VALUES($1,$2,$3,'prep-scan')`,[tenantId,digitalSubmission,digitalObject.id]);
const app=express();app.use(express.json({limit:'25mb'}));installCaseOperations(app,pool,objects,context);
const server=app.listen(0);await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('Unable to start Case Operations test server.');const base=`http://127.0.0.1:${address.port}`;
async function request(path:string,method='GET',body?:unknown){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return{response,payload:await response.json().catch(()=>null)}}

try{
  const reasons=await request('/api/case-operations/hold-reasons');assert.equal(reasons.response.status,200);const holdReason=reasons.payload.find((value:{code:string})=>value.code==='TEST-PAUSE');assert.ok(holdReason);
  const digitalLink=await request(`/api/cases/${caseId}/intake-submissions`,'POST',{submissionId:digitalSubmission});assert.equal(digitalLink.response.status,201);assert.equal(digitalLink.payload.intake.intakeMethod,'DIGITAL');
  const physicalLink=await request(`/api/cases/${caseId}/intake-submissions`,'POST',{submissionId:physicalSubmission});assert.equal(physicalLink.response.status,201);assert.equal(physicalLink.payload.intake.intakeMethod,'HYBRID');
  const linked=await request(`/api/cases/${caseId}/intake-submissions`);assert.equal(linked.response.status,200);assert.equal(linked.payload.length,2);assert.equal(linked.payload[0].submissionChannel,'manual-digital');
  const intake=await request(`/api/cases/${caseId}/intake-method`,'PUT',{intakeMethod:'HYBRID'});assert.equal(intake.response.status,200);assert.equal(intake.payload.intakeMethod,'HYBRID');
  const routing=await request(`/api/cases/${caseId}/intake-routing`);assert.equal(routing.response.status,200);assert.equal(routing.payload.digital.length>0,true);assert.equal(routing.payload.physical.length>0,true);
  const held=await request(`/api/cases/${caseId}/hold`,'POST',{reasonId:holdReason.id,notes:'Controlled hold'});assert.equal(held.response.status,201);assert.equal(held.payload.lifecycleState,'ON_HOLD');
  const released=await request(`/api/cases/${caseId}/release-hold`,'POST',{note:'Resolved'});assert.equal(released.response.status,200);assert.equal(released.payload.lifecycleState,'RELEASED');
  const uploaded=await request(`/api/cases/${caseId}/files`,'POST',{fileName:'shade.jpg',displayName:'Final shade photo',mimeType:'image/jpeg',documentCategory:'SHADE_PHOTO',contentBase64:Buffer.from('case-file').toString('base64')});assert.equal(uploaded.response.status,201);
  const operations=await request(`/api/cases/${caseId}/operations`);assert.equal(operations.response.status,200);assert.equal(operations.payload.files.some((file:{documentCategory:string})=>file.documentCategory==='STL'),true,'Universal Intake object must become a Case File rather than a duplicate attachment store');assert.equal(operations.payload.files.some((file:{documentCategory:string})=>file.documentCategory==='SHADE_PHOTO'),true);assert.equal(operations.payload.storage.durable,true);
  const downloaded=await fetch(`${base}/api/cases/${caseId}/files/${uploaded.payload.id}/download`);assert.equal(downloaded.status,200);assert.equal(await downloaded.text(),'case-file');
  const cancellationReasons=await request('/api/case-operations/cancellation-reasons');const cancelReason=cancellationReasons.payload.find((value:{code:string})=>value.code==='TEST-CANCEL');assert.ok(cancelReason);const missingConfirmation=await request(`/api/cases/${caseId}/cancel`,'POST',{reasonId:cancelReason.id});assert.equal(missingConfirmation.response.status,400);const cancelled=await request(`/api/cases/${caseId}/cancel`,'POST',{reasonId:cancelReason.id,notes:'Preserve evidence',confirmed:true});assert.equal(cancelled.response.status,201);assert.equal(cancelled.payload.lifecycleState,'CANCELLED');
  const crossTenant=await request(`/api/cases/${otherCaseId}/operations`);assert.equal(crossTenant.response.status,404);const foreignSubmission=await request(`/api/cases/${caseId}/intake-submissions`,'POST',{submissionId:otherSubmission});assert.equal(foreignSubmission.response.status,409);
  const kpi=await request('/api/operations/kpi?groupBy=INTAKE_METHOD&rank=TOP_10');assert.equal(kpi.response.status,200);assert.equal(kpi.payload.financialAuthority.available,false);
  console.log('PP-1B-F2A2 operational Case intake integration tests passed.');
}finally{server.close();await pool.end();}
