import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createDurableRuntime } from './infrastructure/runtime.js';
import { installCommunications } from './communications.js';
import type { RequestIdentity, SecurityRequest } from './security.js';

const durable=await createDurableRuntime();
const tenantId=durable.context.tenantId,otherTenant=randomUUID();
const practiceA=randomUUID(),practiceB=randomUUID(),practiceOther=randomUUID();
const doctorA=randomUUID(),doctorB=randomUUID(),doctorOther=randomUUID();
const patientA=randomUUID(),patientB=randomUUID(),patientOther=randomUUID();
const caseA=randomUUID(),caseB=randomUUID(),caseOther=randomUUID();
const adminId=randomUUID(),scopedId=randomUUID(),inactiveId=randomUUID();
const now=new Date().toISOString();

await durable.pool.query(`INSERT INTO tenants(id,name) VALUES($1,'Communications Other Tenant') ON CONFLICT DO NOTHING`,[otherTenant]);
for(const [tenant,practice,account,name] of [[tenantId,practiceA,'COMM-A','Practice A'],[tenantId,practiceB,'COMM-B','Practice B'],[otherTenant,practiceOther,'COMM-O','Other Practice']] as const)await durable.pool.query(`INSERT INTO practices(id,tenant_id,account_number,practice_name,status,phone,email,address,city,state,postal_code,created_at,updated_at) VALUES($1,$2,$3,$4,'active','555','test@example.com','1 Main','Northridge','CA','91324',$5,$5)`,[practice,tenant,account,name,now]);
for(const [tenant,id,practice,email] of [[tenantId,doctorA,practiceA,'doctor-a@example.com'],[tenantId,doctorB,practiceB,'doctor-b@example.com'],[otherTenant,doctorOther,practiceOther,'doctor-o@example.com']] as const)await durable.pool.query(`INSERT INTO doctors(id,tenant_id,practice_id,first_name,last_name,email,status,created_at,updated_at) VALUES($1,$2,$3,'Test','Doctor',$4,'active',$5,$5)`,[id,tenant,practice,email,now]);
for(const [tenant,id,practice,doctor,reference] of [[tenantId,patientA,practiceA,doctorA,'PA'],[tenantId,patientB,practiceB,doctorB,'PB'],[otherTenant,patientOther,practiceOther,doctorOther,'PO']] as const)await durable.pool.query(`INSERT INTO patients(id,tenant_id,practice_id,doctor_id,patient_reference,first_name,last_name,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'Test','Patient','active',$6,$6)`,[id,tenant,practice,doctor,reference,now]);
for(const [tenant,id,number,patient,practice,doctor] of [[tenantId,caseA,'COMM-CASE-A',patientA,practiceA,doctorA],[tenantId,caseB,'COMM-CASE-B',patientB,practiceB,doctorB],[otherTenant,caseOther,'COMM-CASE-O',patientOther,practiceOther,doctorOther]] as const)await durable.pool.query(`INSERT INTO clinical_cases(id,tenant_id,case_number,patient_id,practice_id,doctor_id,status,arch,restoration,material,shade,rush_priority,received_date,due_date,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,'received','mandibular','Crown','Zirconia','A2','standard',current_date,current_date+10,$7,$7)`,[id,tenant,number,patient,practice,doctor,now]);
for(const [id,email,active] of [[adminId,'admin-comm@example.com',true],[scopedId,'scoped-comm@example.com',true],[inactiveId,'inactive-comm@example.com',false]] as const)await durable.pool.query(`INSERT INTO users(id,tenant_id,email,name,role,active) VALUES($1,$2,$3,'Communication User','customer-service',$4)`,[id,tenantId,email,active]);
await durable.pool.query(`INSERT INTO identity_memberships(tenant_id,user_id,role,practice_ids,location_ids,administrative_override) VALUES($1,$2,'system-administrator','{}','{}',true),($1,$3,'customer-service',$4,'{}',false),($1,$5,'customer-service',$4,'{}',false)`,[tenantId,adminId,scopedId,[practiceA],inactiveId]);

const admin:RequestIdentity={userId:adminId,name:'Admin',email:'admin-comm@example.com',role:'system-administrator',tenantId,locationIds:[],practiceIds:[],administrativeOverride:true,sessionId:'admin-session',csrfToken:'test'};
const scoped:RequestIdentity={userId:scopedId,name:'Scoped',email:'scoped-comm@example.com',role:'customer-service',tenantId,locationIds:[],practiceIds:[practiceA],administrativeOverride:false,sessionId:'scoped-session',csrfToken:'test'};
async function serverFor(identity:RequestIdentity){const app=express();app.use(express.json({limit:'25mb'}));app.use((req:SecurityRequest,_res,next)=>{req.identity=identity;next()});installCommunications(app,durable.pool,durable.objects);const server=app.listen(0);await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address() as AddressInfo;return{server,base:`http://127.0.0.1:${address.port}`}}
async function request(base:string,path:string,method='GET',body?:unknown){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return{response,payload:await response.json().catch(()=>null)}}

const adminServer=await serverFor(admin),scopedServer=await serverFor(scoped);
try{
 const thread=await request(adminServer.base,'/api/communications/threads','POST',{entityType:'case',entityId:caseA,subject:'Shade clarification'});assert.equal(thread.response.status,201);const threadId=String(thread.payload.id);
 const created=await request(adminServer.base,'/api/communications/events','POST',{entityType:'case',entityId:caseA,threadId,eventType:'doctor-message',content:'Initial shade request',attachments:[{fileName:'shade-photo.png',mimeType:'image/png',kind:'clinical-photo',contentBase64:Buffer.from('image').toString('base64')}],notify:[{userId:scopedId,priority:'high',category:'clinical'}]});assert.equal(created.response.status,201);assert.equal(created.payload.attachments[0].fileName,'shade-photo.png');assert.equal('objectKey'in created.payload.attachments[0],false,'internal object keys must not be exposed');
 const second=await request(adminServer.base,'/api/communications/events','POST',{entityType:'case',entityId:caseA,threadId,eventType:'doctor-message',content:'Doctor confirmed A2 body.'});assert.equal(second.response.status,201);
 const timeline=await request(scopedServer.base,`/api/communications/timeline?entityType=case&entityId=${caseA}`);assert.equal(timeline.response.status,200);assert.deepEqual(timeline.payload.map((item:{id:string})=>item.id),[created.payload.id,second.payload.id]);
 const deniedTimeline=await request(scopedServer.base,`/api/communications/timeline?entityType=case&entityId=${caseB}`);assert.equal(deniedTimeline.response.status,403,'same-tenant different-practice access must be denied');
 const deniedCreate=await request(scopedServer.base,'/api/communications/events','POST',{entityType:'case',entityId:caseB,eventType:'internal-note',content:'Unauthorized'});assert.equal(deniedCreate.response.status,403);
 const search=await request(scopedServer.base,'/api/communications/search?q=Doctor');assert.equal(search.response.status,200);assert.ok(search.payload.every((item:{entityId:string})=>item.entityId===caseA),'search must filter unauthorized practices');
 const otherThread=await durable.pool.query<{id:string}>(`INSERT INTO communication_threads(tenant_id,entity_type,entity_id,subject,created_by,created_by_role) VALUES($1,'case',$2,'Other tenant','other','system-administrator') RETURNING id`,[otherTenant,caseOther]);
 const crossTenant=await request(adminServer.base,'/api/communications/events','POST',{entityType:'case',entityId:caseA,threadId:otherThread.rows[0]?.id,eventType:'internal-note',content:'Invalid thread'});assert.equal(crossTenant.response.status,409,'cross-tenant thread references must be rejected');
 const foreignObject=await durable.objects.put({tenantId,ownerType:'case',ownerId:caseB,kind:'clinical-photo',fileName:'foreign.png',mimeType:'image/png',bytes:Buffer.from('foreign')});
 const deniedAttachment=await request(scopedServer.base,'/api/communications/events','POST',{entityType:'case',entityId:caseA,eventType:'attachment',content:'Invalid attachment',attachmentObjectIds:[foreignObject.id]});assert.equal(deniedAttachment.response.status,403,'cross-practice attachment association must be denied');
 const invalidRecipient=await request(adminServer.base,'/api/communications/events','POST',{entityType:'case',entityId:caseA,eventType:'internal-note',content:'Invalid recipient',notify:[{userId:inactiveId}]});assert.equal(invalidRecipient.response.status,400);
 const mismatch=await request(adminServer.base,'/api/communications/events','POST',{entityType:'case',entityId:caseB,threadId,eventType:'internal-note',content:'Mismatched thread'});assert.equal(mismatch.response.status,409);
 const auditRows=await durable.pool.query(`SELECT action,metadata FROM audit_events WHERE tenant_id=$1 AND entity_id=$2 ORDER BY occurred_at`,[tenantId,caseA]);assert.ok(auditRows.rows.some(row=>row.action==='communications.thread.created'));assert.ok(auditRows.rows.some(row=>row.action==='communications.event.created'));assert.ok(auditRows.rows.every(row=>!JSON.stringify(row.metadata).includes('Initial shade request')),'security audit must not duplicate clinical content');
 await assert.rejects(()=>durable.pool.query('UPDATE communication_events SET content=$1 WHERE id=$2',['mutated',created.payload.id]),/append-only/);
 console.log('Sprint 11 hardened communications integration tests passed.');
}finally{adminServer.server.close();scopedServer.server.close();await durable.pool.end()}
