import express from 'express';
import cors from 'cors';
import type { ClinicalCase, DashboardSnapshot, FinancialDashboardSnapshot, Practice } from '@northstar/shared';
import { createQcEngine } from './qc.js';
import { createShippingEngine } from './shipping.js';
import { createBillingEngine, InMemoryFinancialRepository } from './billing.js';

process.env.PORT='4001';
await import('./server.js');
const app=express();const port=4000;const upstream='http://127.0.0.1:4001';const now=()=>new Date().toISOString();
app.use(cors());app.use(express.json({limit:'25mb'}));
async function listCases():Promise<ClinicalCase[]>{const response=await fetch(`${upstream}/api/cases`);if(!response.ok)throw new Error('Unable to load clinical cases.');return response.json() as Promise<ClinicalCase[]>}
async function fetchCase(caseId:string):Promise<ClinicalCase|null>{const response=await fetch(`${upstream}/api/cases/${caseId}`);return response.ok?response.json() as Promise<ClinicalCase>:null}
async function updateCase(caseId:string,value:ClinicalCase){const response=await fetch(`${upstream}/api/cases/${caseId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientId:value.patientId,practiceId:value.practiceId,doctorId:value.doctorId,status:value.status,toothNumbers:value.toothNumbers,arch:value.arch,restoration:value.restoration,material:value.material,shade:value.shade,stumpShade:value.stumpShade,rushPriority:value.rushPriority,receivedDate:value.receivedDate,prescriptionNotes:value.prescriptionNotes})});if(!response.ok)throw new Error('Unable to synchronize case state.')}
async function resolvePractice(id:string):Promise<Practice|null>{const response=await fetch(`${upstream}/api/practices`);if(!response.ok)return null;const practices=await response.json() as Practice[];return practices.find(item=>item.id===id)??null}
const qc=createQcEngine(app,now,fetchCase,updateCase);
const repository=new InMemoryFinancialRepository();
const billing=createBillingEngine(app,now,repository,resolvePractice);
const shipping=createShippingEngine(app,now,listCases,updateCase,billing.invoiceShipment);
app.get('/api/dashboard',async(_req,res)=>{const response=await fetch(`${upstream}/api/dashboard`);if(!response.ok)return res.status(response.status).send(await response.text());const snapshot=await response.json() as DashboardSnapshot;const metrics=qc.metrics();const logistics=shipping.metrics();const financial=await billing.metrics();const value:FinancialDashboardSnapshot={...snapshot,qcPassRate:metrics.passRate,qcRemakeRate:metrics.remakeRate,qcReworkRate:metrics.reworkRate,qcFirstPassYield:metrics.firstPassYield,qcDefectTrends:metrics.defectTrends,logistics,financial};return res.json(value)});
app.use(async(req,res)=>{const headers=new Headers();for(const [key,value] of Object.entries(req.headers)){if(typeof value==='string'&&key.toLowerCase()!=='host'&&key.toLowerCase()!=='content-length')headers.set(key,value)}const hasBody=!['GET','HEAD'].includes(req.method);const response=await fetch(`${upstream}${req.originalUrl}`,{method:req.method,headers,body:hasBody?JSON.stringify(req.body):undefined});res.status(response.status);response.headers.forEach((value,key)=>{if(key.toLowerCase()!=='content-encoding'&&key.toLowerCase()!=='content-length')res.setHeader(key,value)});return res.send(Buffer.from(await response.arrayBuffer()))});
app.listen(port,()=>console.log(`CADence NorthStar financial gateway listening on http://localhost:${port}`));
