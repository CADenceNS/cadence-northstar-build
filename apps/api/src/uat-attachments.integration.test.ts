import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { Pool } from 'pg';
import { PostgresObjectStorage } from './infrastructure/postgres-object-storage.js';
import { installUatAttachments } from './uat-attachments.js';
import type { AuditEventInput, AuditRepository } from './infrastructure/contracts.js';
import type { SecurityRequest } from './security.js';

const databaseUrl=process.env.DATABASE_URL;if(!databaseUrl)throw new Error('DATABASE_URL is required.');
const pool=new Pool({connectionString:databaseUrl}),objects=new PostgresObjectStorage(pool);const tenantA='00000000-0000-0000-0000-000000000001',tenantB='00000000-0000-0000-0000-000000000002';
await pool.query(`INSERT INTO tenants(id,name) VALUES($1,'Keramos'),($2,'Sample Lab') ON CONFLICT(id) DO NOTHING`,[tenantA,tenantB]);
const plan=(await pool.query(`INSERT INTO uat_test_plans(tenant_id,name,sprint,module,owner_id,owner_name,status,target_environment,build_version) VALUES($1,'Attachment Plan','Sprint 13A','UAT','tester','Tester','ready','uat','test') RETURNING id`,[tenantA])).rows[0];
const testCase=(await pool.query(`INSERT INTO uat_test_cases(tenant_id,plan_id,title,category,expected_result,related_module,priority,severity) VALUES($1,$2,'Attach evidence','Evidence','Screenshot is controlled.','UAT','high','high') RETURNING id`,[tenantA,plan.id])).rows[0];
const audits:AuditEventInput[]=[];const audit:AuditRepository={append:async value=>{audits.push(value)},list:async()=>audits};
const app=express();app.use(express.json({limit:'8mb'}));app.use((req:SecurityRequest,_res,next)=>{const tenant=req.header('x-test-tenant')||tenantA;req.identity={userId:'tester',name:'UAT Tester',email:'tester@example.test',role:'laboratory-administrator',tenantId:tenant,locationIds:[],practiceIds:[],administrativeOverride:true,sessionId:'test',csrfToken:'test'};next()});installUatAttachments(app,{pool,objects,audit});
const server=app.listen(0);await once(server,'listening');const address=server.address();if(!address||typeof address==='string')throw new Error('Unable to listen.');const base=`http://127.0.0.1:${address.port}`;
const request=async(path:string,init:RequestInit={})=>{const response=await fetch(`${base}${path}`,{...init,headers:{'Content-Type':'application/json',...(init.headers||{})}});const type=response.headers.get('content-type')||'';const body=type.includes('json')?await response.json():new Uint8Array(await response.arrayBuffer());return{response,body}};
try{
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nGQAAAAASUVORK5CYII=';
 const created=await request(`/api/uat/evidence/test-case/${testCase.id}/attachments`,{method:'POST',body:JSON.stringify({fileName:'screen shot.png',mimeType:'image/png',contentBase64:png})});assert.equal(created.response.status,201);assert.equal(created.body.fileName,'screen_shot.png');assert.equal('objectKey' in created.body,false);const attachmentId=created.body.id;
 const listed=await request(`/api/uat/evidence/test-case/${testCase.id}/attachments`);assert.equal(listed.response.status,200);assert.equal(listed.body.length,1);assert.equal('objectKey' in listed.body[0],false);
 const content=await request(`/api/uat/attachments/${attachmentId}/content`);assert.equal(content.response.status,200);assert.equal(content.response.headers.get('content-type'),'image/png');assert.equal((content.body as Uint8Array).length>0,true);
 const invalid=await request(`/api/uat/evidence/test-case/${testCase.id}/attachments`,{method:'POST',body:JSON.stringify({fileName:'bad.svg',mimeType:'image/svg+xml',contentBase64:'PHN2Zz4='})});assert.equal(invalid.response.status,415);
 const crossTenantList=await request(`/api/uat/evidence/test-case/${testCase.id}/attachments`,{headers:{'x-test-tenant':tenantB}});assert.equal(crossTenantList.response.status,404);
 const crossTenantDownload=await request(`/api/uat/attachments/${attachmentId}/content`,{headers:{'x-test-tenant':tenantB}});assert.equal(crossTenantDownload.response.status,404);
 assert.equal(audits.some(value=>value.action==='uat.evidence.attached'),true);
 console.log('UAT screenshot attachment integration passed.');
}finally{server.close();await pool.end()}
