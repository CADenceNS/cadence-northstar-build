import express from 'express';
import cors from 'cors';
import type { ClinicalCase, DashboardSnapshot, FinancialDashboardSnapshot, Practice } from '@northstar/shared';
import { createQcEngine } from './qc.js';
import { createShippingEngine } from './shipping.js';
import { createBillingEngine } from './billing.js';
import { createDurableRuntime, LegacyFinancialRepositoryAdapter } from './infrastructure/runtime.js';
import { installSecurity, SecurityService, type SecurityRequest } from './security.js';
import { installCommunications } from './communications.js';

const durable=await createDurableRuntime();
process.env.PORT='4001';
await import('./durable-server.js');
const app=express();const port=4000;const upstream='http://127.0.0.1:4001';const now=()=>new Date().toISOString();
app.use(cors({origin:true,credentials:true}));app.use(express.json({limit:'25mb'}));
app.get('/health',async(_req,res)=>{const response=await fetch(`${upstream}/health`);res.status(response.status);return res.send(Buffer.from(await response.arrayBuffer()))});
const security=new SecurityService(durable.pool,durable.repositories.users,durable.repositories.audit,durable.context);
await installSecurity(app,security);
app.use((req:SecurityRequest,_res,next)=>{if(req.identity&&req.body&&typeof req.body==='object'){req.body.actorId=req.body.actorId||req.identity.userId;req.body.actorName=req.body.actorName||req.identity.name;req.body.recordedBy=req.body.recordedBy||req.identity.name;req.body.uploadedBy=req.body.uploadedBy||req.identity.name}next()});
installCommunications(app,durable.pool,durable.objects);
async function listCases():Promise<ClinicalCase[]>{const response=await fetch(`${upstream}/api/cases`);if(!response.ok)throw new Error('Unable to load clinical cases.');return response.json() as Promise<ClinicalCase[]>}
async function fetchCase(caseId:string):Promise<ClinicalCase|null>{const response=await fetch(`${upstream}/api/cases/${caseId}`);return response.ok?response.json() as Promise<ClinicalCase>:null}
async function updateCase(caseId:string,value:ClinicalCase){const response=await fetch(`${upstream}/api/cases/${caseId}`,{method:'PUT',headers:{'Content-Type':'application/json','x-northstar-suppress-audit':'true'},body:JSON.stringify({patientId:value.patientId,practiceId:value.practiceId,doctorId:value.doctorId,status:value.status,toothNumbers:value.toothNumbers,arch:value.arch,restoration:value.restoration,material:value.material,shade:value.shade,stumpShade:value.stumpShade,rushPriority:value.rushPriority,receivedDate:value.receivedDate,prescriptionNotes:value.prescriptionNotes})});if(!response.ok)throw new Error('Unable to synchronize case state.')}
async function resolvePractice(id:string):Promise<Practice|null>{const response=await fetch(`${upstream}/api/practices`);if(!response.ok)return null;const practices=await response.json() as Practice[];return practices.find(item=>item.id===id)??null}
const qc=createQcEngine(app,now,fetchCase,updateCase,{repository:durable.repositories.qc,objects:durable.objects,audit:durable.repositories.audit,context:durable.context});
const billing=createBillingEngine(app,now,new LegacyFinancialRepositoryAdapter(durable),resolvePractice,{audit:durable.repositories.audit,context:durable.context});
const shipping=createShippingEngine(app,now,listCases,updateCase,billing.invoiceShipment,{repository:durable.repositories.shipping,audit:durable.repositories.audit,context:durable.context});
app.get('/api/dashboard',async(_req,res)=>{const response=await fetch(`${upstream}/api/dashboard`);if(!response.ok)return res.status(response.status).send(await response.text());const snapshot=await response.json() as DashboardSnapshot;const metrics=await qc.metrics();const logistics=await shipping.metrics();const financial=await billing.metrics();const value:FinancialDashboardSnapshot={...snapshot,qcPassRate:metrics.passRate,qcRemakeRate:metrics.remakeRate,qcReworkRate:metrics.reworkRate,qcFirstPassYield:metrics.firstPassYield,qcDefectTrends:metrics.defectTrends,logistics,financial};return res.json(value)});
app.use(async(req:SecurityRequest,res)=>{const headers=new Headers();for(const[key,value]of Object.entries(req.headers)){if(typeof value==='string'&&!['host','content-length','cookie','x-actor-id','x-actor-name','x-northstar-role','x-northstar-tenant'].includes(key.toLowerCase()))headers.set(key,value)}if(req.identity){headers.set('x-actor-id',req.identity.userId);headers.set('x-actor-name',req.identity.name);headers.set('x-northstar-role',req.identity.role);headers.set('x-northstar-tenant',req.identity.tenantId);headers.set('x-northstar-session',req.identity.sessionId)}const hasBody=!['GET','HEAD'].includes(req.method);const response=await fetch(`${upstream}${req.originalUrl}`,{method:req.method,headers,body:hasBody?JSON.stringify(req.body):undefined});res.status(response.status);response.headers.forEach((value,key)=>{if(key.toLowerCase()!=='content-encoding'&&key.toLowerCase()!=='content-length')res.setHeader(key,value)});return res.send(Buffer.from(await response.arrayBuffer()))});
const server=app.listen(port,()=>console.log(`CADence NorthStar secure gateway listening on http://localhost:${port}`));
const shutdown=async()=>{server.close();await durable.pool.end()};
process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);