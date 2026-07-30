import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { Pool } from 'pg';
import { installUatFoundation } from './uat.js';
import type { AuditRepository, AuditRecord } from './infrastructure/contracts.js';
import type { SecurityRequest } from './security.js';

const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error('DATABASE_URL is required.');
const pool=new Pool({connectionString:databaseUrl});
const tenantA='00000000-0000-0000-0000-000000000001';
const tenantB='00000000-0000-0000-0000-000000000002';
await pool.query(`INSERT INTO tenants(id,name) VALUES($1,'Keramos UAT'),($2,'Sample Laboratory') ON CONFLICT(id) DO NOTHING`,[tenantA,tenantB]);
const audits:AuditRecord[]=[];
const audit:AuditRepository={append:async(value)=>{audits.push(value);return value},list:async()=>audits};
const app=express();app.use(express.json());app.use((req:SecurityRequest,_res,next)=>{const tenant=req.header('x-test-tenant')||tenantA;const role=req.header('x-test-role')||'system-administrator';req.identity={userId:`user-${role}`,name:`Test ${role}`,email:`${role}@example.test`,role:role as never,tenantId:tenant,locationIds:['location-primary'],practiceIds:[],administrativeOverride:role==='system-administrator',sessionId:'test-session',csrfToken:'test'};next()});installUatFoundation(app,{pool,audit});
const server=app.listen(0);await once(server,'listening');const address=server.address();if(!address||typeof address==='string')throw new Error('Unable to start UAT test server.');const base=`http://127.0.0.1:${address.port}`;
async function request(path:string,init:RequestInit={}){const response=await fetch(`${base}${path}`,{...init,headers:{'Content-Type':'application/json',...(init.headers||{})}});const body=response.status===204?null:await response.json();return{response,body}}

try{
 const information=await request('/api/system/information');assert.equal(information.response.status,200);assert.equal(information.body.migrationVersion,'0007');
 const deniedInfo=await request('/api/system/information',{headers:{'x-test-role':'doctor'}});assert.equal(deniedInfo.response.status,403);
 const plan=await request('/api/uat/plans',{method:'POST',body:JSON.stringify({name:'Role Routing',module:'Authentication',description:'Validate landing routes.'})});assert.equal(plan.response.status,201);const planId=plan.body.id;
 const testCase=await request(`/api/uat/plans/${planId}/cases`,{method:'POST',body:JSON.stringify({title:'Doctor sees scoped case dashboard',expectedResult:'Doctor reaches the case workspace and cannot view another Practice.',relatedModule:'Authorization',priority:'critical',severity:'critical',steps:['Login','Open Cases']})});assert.equal(testCase.response.status,201);
 const execution=await request(`/api/uat/cases/${testCase.body.id}/execute`,{method:'POST',headers:{'x-test-role':'doctor'},body:JSON.stringify({status:'pass',actualResult:'Scoped dashboard loaded.',notes:'No unauthorized links.'})});assert.equal(execution.response.status,201);
 const defect=await request('/api/uat/defects',{method:'POST',headers:{'x-test-role':'doctor'},body:JSON.stringify({title:'Example UAT issue',description:'Demonstrates the defect lifecycle.',module:'Doctor Portal',severity:'medium',priority:'medium',relatedTestCaseId:testCase.body.id})});assert.equal(defect.response.status,201);assert.match(defect.body.defect_number,/^DEF-/);
 const triaged=await request(`/api/uat/defects/${defect.body.id}`,{method:'PATCH',body:JSON.stringify({status:'triaged',assigneeName:'QA Lead'})});assert.equal(triaged.response.status,200);assert.equal(triaged.body.status,'triaged');
 const flag=await request('/api/feature-flags/ecc',{method:'PUT',body:JSON.stringify({enabled:true,description:'Executive preview',environments:['development'],roles:['system-administrator']})});assert.equal(flag.response.status,200);
 const flags=await request('/api/feature-flags');assert.equal(flags.response.status,200);assert.equal(flags.body.some((item:{key:string})=>item.key==='ecc'),true);
 const seed=await request('/api/uat/seed',{method:'POST',body:'{}'});assert.equal(seed.response.status,201);
 const plans=await request('/api/uat/plans');assert.equal(plans.response.status,200);assert.equal(plans.body.length>=2,true);
 const readiness=await request('/api/uat/readiness');assert.equal(readiness.response.status,200);assert.equal(readiness.body.total>0,true);
 const tenantBPlans=await request('/api/uat/plans',{headers:{'x-test-tenant':tenantB}});assert.equal(tenantBPlans.response.status,200);assert.equal(tenantBPlans.body.length,0,'UAT plans must remain tenant-isolated.');
 const forbiddenPlan=await request('/api/uat/plans',{method:'POST',headers:{'x-test-role':'doctor'},body:JSON.stringify({name:'Forbidden',module:'Security'})});assert.equal(forbiddenPlan.response.status,403);
 assert.equal(audits.some(item=>item.action==='uat.plan.created'),true);assert.equal(audits.some(item=>item.action==='uat.execution.recorded'),true);assert.equal(audits.some(item=>item.action==='uat.defect.created'),true);assert.equal(audits.some(item=>item.action==='feature-flag.updated'),true);
 console.log('Sprint 13A UAT integration passed.');
}finally{server.close();await pool.end()}
