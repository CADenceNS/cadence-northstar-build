import express from 'express';
import cors from 'cors';
import type { ClinicalCase, DashboardSnapshot, FinancialDashboardSnapshot, Practice } from '@northstar/shared';
import { createQcEngine } from './qc.js';
import { createShippingEngine } from './shipping.js';
import { createBillingEngine } from './billing.js';
import { createDurableRuntime, LegacyFinancialRepositoryAdapter } from './infrastructure/runtime.js';
import { installSecurity, SecurityService, type SecurityRequest } from './security.js';
import { installCommunications } from './communications.js';
import { installDigitalIntake } from './digital-intake.js';
import { installIntakeAdministration } from './intake-administration.js';
import { installProductCatalogFoundation } from './product-catalog-foundation.js';
import { installUatFoundation } from './uat.js';
import { installUatIdentityExperience, provisionUatIdentities } from './uat-identity.js';

const durable=await createDurableRuntime();
await provisionUatIdentities(durable.pool);
process.env.PORT='4001';
await import('./durable-server.js');
const app=express();const port=4000;const upstream='http://127.0.0.1:4001';const now=()=>new Date().toISOString();
app.use(cors({origin:true,credentials:true}));app.use(express.json({limit:'25mb'}));
app.get('/health',async(_req,res)=>{const response=await fetch(`${upstream}/health`);res.status(response.status);return res.send(Buffer.from(await response.arrayBuffer()))});
installUatIdentityExperience(app,{pool:durable.pool,audit:durable.repositories.audit,context:durable.context});
const security=new SecurityService(durable.pool,durable.repositories.users,durable.repositories.audit,durable.context);
await installSecurity(app,security);
app.use((req:SecurityRequest,_res,next)=>{if(req.identity&&req.body&&typeof req.body==='object'){req.body.actorId=req.body.actorId||req.identity.userId;req.body.actorName=req.body.actorName||req.identity.name;req.body.recordedBy=req.body.recordedBy||req.identity.name;req.body.uploadedBy=req.body.uploadedBy||req.identity.name}next()});
installUatFoundation(app,{pool:durable.pool,audit:durable.repositories.audit});
installCommunications(app,durable.pool,durable.objects);
const intakeWriters=new Set(['system-administrator','laboratory-administrator','tenant-owner','tenant-administrator','office-manager','customer-service','billing']);
app.use('/api/intake',(req:SecurityRequest,res,next)=>{if(!req.identity)return res.status(401).json({error:'Authentication required.'});if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!intakeWriters.has(req.identity.role))return res.status(403).json({error:'Permission denied.'});return next()});
installIntakeAdministration(app,{pool:durable.pool,audit:durable.repositories.audit});
installProductCatalogFoundation(app,durable.pool,durable.repositories.audit);
async function createOperationalCase(input:Record<string,unknown>){const response=await fetch(`${upstream}/api/cases`,{method:'POST',headers:{'Content-Type':'application/json','x-actor-id':'digital-intake','x-actor-name':'Digital Intake Platform','x-northstar-role':'system-administrator','x-northstar-tenant':durable.context.tenantId},body:JSON.stringify(input)});if(!response.ok)throw new Error(`Operational case creation failed: ${await response.text()}`);return response.json() as Promise<{id:string;caseNumber:string}>}
installDigitalIntake(app,{pool:durable.pool,objects:durable.objects,audit:durable.repositories.audit,context:durable.context,createOperationalCase});
async function listCases():Promise<ClinicalCase[]>{const response=await fetch(`${upstream}/api/cases`);if(!response.ok)throw new Error('Unable to load clinical cases.');return response.json() as Promise<ClinicalCase[]>}
async function fetchCase(caseId:string):Promise<ClinicalCase|null>{const response=await fetch(`${upstream}/api/cases/${caseId}`);return response.ok?response.json() as Promise<ClinicalCase>:null}
async function updateCase(caseId:string,value:ClinicalCase){const response=await fetch(`${upstream}/api/cases/${caseId}`,{method:'PUT',headers:{'Content-Type':'application/json','x-northstar-suppress-audit':'true'},body:JSON.stringify({patientId:value.patientId,practiceId:value.practiceId,doctorId:value.doctorId,status:value.status,toothNumbers:value.toothNumbers,arch:value.arch,restoration:value.restoration,material:value.material,shade:value.shade,stumpShade:value.stumpShade,rushPriority:value.rushPriority,receivedDate:value.receivedDate,prescriptionNotes:value.prescriptionNotes})});if(!response.ok)throw new Error('Unable to synchronize case state.')}
async function resolvePractice(id:string):Promise<Practice|null>{const response=await fetch(`${upstream}/api/practices`);if(!response.ok)return null;const practices=await response.json() as Practice[];return practices.find(item=>item.id===id)??null}
const qc=createQcEngine(app,now,fetchCase,updateCase,{repository:durable.repositories.qc,objects:durable.objects,audit:durable.repositories.audit,context:durable.context});
const billing=createBillingEngine(app,now,new LegacyFinancialRepositoryAdapter(durable),resolvePractice,{audit:durable.repositories.audit,context:durable.context});
const shipping=createShippingEngine(app,now,listCases,updateCase,billing.invoiceShipment,{repository:durable.repositories.shipping,audit:durable.repositories.audit,context:durable.context});
app.get('/api/dashboard',async(req:SecurityRequest,res)=>{if(req.identity?.tenantId!==durable.context.tenantId){const result=await durable.pool.query(`SELECT (SELECT COUNT(*)::int FROM clinical_cases WHERE tenant_id=$1 AND deleted_at IS NULL AND status<>'completed') AS "openCases",(SELECT COUNT(*)::int FROM practices WHERE tenant_id=$1 AND deleted_at IS NULL AND status='active') AS "activePractices",(SELECT COUNT(*)::int FROM doctors WHERE tenant_id=$1 AND deleted_at IS NULL AND status='active') AS "activeDoctors",(SELECT COALESCE(SUM(balance),0)::numeric FROM invoices WHERE tenant_id=$1 AND deleted_at IS NULL) AS "outstandingAR"`,[req.identity.tenantId]);const row=result.rows[0];return res.json({generatedAt:new Date().toISOString(),casesReceivedToday:0,casesDueToday:0,casesAtRisk:0,casesInQc:0,shipmentsReady:0,monthRevenue:0,activeDoctors:row.activeDoctors,activePractices:row.activePractices,activePatients:0,openCases:row.openCases,rushCases:0,productionOverdue:0,productionInProgress:0,departmentWorkload:[],qcPassRate:0,qcRemakeRate:0,qcReworkRate:0,qcFirstPassYield:0,qcDefectTrends:[],logistics:{readyToShip:0,awaitingPickup:0,shipped:0,delivered:0,totalShipments:0,deliveredOnTime:0},financial:{invoicedTotal:0,collectedTotal:0,outstandingAR:Number(row.outstandingAR),overdueAR:0,invoiceCount:0,paidInvoiceCount:0,averageDaysToPay:0,aging:{current:Number(row.outstandingAR),days1To30:0,days31To60:0,days61To90:0,over90:0,total:Number(row.outstandingAR)}}});}const response=await fetch(`${upstream}/api/dashboard`);if(!response.ok)return res.status(response.status).send(await response.text());const snapshot=await response.json() as DashboardSnapshot;const metrics=await qc.metrics();const logistics=await shipping.metrics();const financial=await billing.metrics();const value:FinancialDashboardSnapshot={...snapshot,qcPassRate:metrics.passRate,qcRemakeRate:metrics.remakeRate,qcReworkRate:metrics.reworkRate,qcFirstPassYield:metrics.firstPassYield,qcDefectTrends:metrics.defectTrends,logistics,financial};return res.json(value)});
app.use(async(req:SecurityRequest,res)=>{if(req.identity?.tenantId!==durable.context.tenantId&&req.path.startsWith('/api/'))return res.status(403).json({error:'This UAT tenant is isolated from the legacy CP2 operational runtime. Tenant-native ERP repositories are scheduled after Sprint 13A.'});const headers=new Headers();for(const[key,value]of Object.entries(req.headers)){if(typeof value==='string'&&!['host','content-length','cookie','x-actor-id','x-actor-name','x-northstar-role','x-northstar-tenant'].includes(key.toLowerCase()))headers.set(key,value)}if(req.identity){headers.set('x-actor-id',req.identity.userId);headers.set('x-actor-name',req.identity.name);headers.set('x-northstar-role',req.identity.role);headers.set('x-northstar-tenant',req.identity.tenantId);headers.set('x-northstar-session',req.identity.sessionId)}const hasBody=!['GET','HEAD'].includes(req.method);const response=await fetch(`${upstream}${req.originalUrl}`,{method:req.method,headers,body:hasBody?JSON.stringify(req.body):undefined});res.status(response.status);response.headers.forEach((value,key)=>{if(key.toLowerCase()!=='content-encoding'&&key.toLowerCase()!=='content-length')res.setHeader(key,value)});return res.send(Buffer.from(await response.arrayBuffer()))});
const server=app.listen(port,()=>console.log(`CADence NorthStar secure gateway listening on http://localhost:${port}`));
const shutdown=async()=>{server.close();await durable.pool.end()};
process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
