import express from 'express';
import cors from 'cors';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { ClinicalCase, DashboardSnapshot, FinancialDashboardSnapshot, Practice } from '@northstar/shared';
import { createQcEngine } from './qc.js';
import { createShippingEngine } from './shipping.js';
import { createBillingEngine } from './billing.js';
import { createDurableRuntime, LegacyFinancialRepositoryAdapter } from './infrastructure/runtime.js';
import type { RepositoryContext } from './infrastructure/contracts.js';
import { installSecurity, SecurityService, type SecurityRequest } from './security.js';
import { installCommunications } from './communications.js';
import { installDigitalIntake } from './digital-intake.js';
import { installIntakeAdministration } from './intake-administration.js';
import { installProductCatalogFoundation } from './product-catalog-foundation.js';
import { installUatFoundation } from './uat.js';
import { installUatAttachments } from './uat-attachments.js';
import { installUatIdentityExperience, provisionUatIdentities } from './uat-identity.js';
import { internalTenantContextHeader, issueInternalTenantContext } from './trusted-tenant-context.js';
import { CommercialEntitlementService, CommercialAccessError, moduleCatalog, reconcileLegacyNorthstarCoreBootstrap, type ModuleKey } from './infrastructure/commercial-entitlements.js';
import { commercialErrorHandler, installCommercialControlPlane } from './commercial-control-plane.js';

const durable=await createDurableRuntime();
const gatewayRequestContexts=new AsyncLocalStorage<RepositoryContext>();
const gatewayContext=new Proxy(durable.context,{get:(target,key,receiver)=>Reflect.get(gatewayRequestContexts.getStore()??target,key,receiver)}) as RepositoryContext;
await provisionUatIdentities(durable.pool);
process.env.PORT='4001';
await import('./durable-server.js');
const app=express();const port=4000;const upstream='http://127.0.0.1:4001';const now=()=>new Date().toISOString();
app.use(cors({origin:true,credentials:true}));app.use(express.json({limit:'25mb'}));
app.use((req,res,next)=>req.header(internalTenantContextHeader)?res.status(403).json({error:'Client-supplied tenant context is not accepted.'}):next());
app.use((req,res,next)=>{const body=req.body&&typeof req.body==='object'?req.body as Record<string,unknown>:{};const query=req.query as Record<string,unknown>;const suppliedHeader=['x-tenant-id','x-northstar-tenant','x-tenant-context','x-organization-id'].some(name=>Boolean(req.header(name)));const suppliedValue=[body.tenantId,body.tenant_id,body.organizationId,body.organization_id,query.tenantId,query.tenant_id,query.organizationId,query.organization_id].find(value=>typeof value==='string'&&value.trim());return suppliedHeader||suppliedValue?res.status(403).json({error:'Client-supplied tenant selection is not accepted.'}):next()});
app.get('/health',async(_req,res)=>{const response=await fetch(`${upstream}/health`);res.status(response.status);return res.send(Buffer.from(await response.arrayBuffer()))});
installUatIdentityExperience(app,{pool:durable.pool,audit:durable.repositories.audit,context:durable.context});
const security=new SecurityService(durable.pool,durable.repositories.users,durable.repositories.audit,durable.context);
const commercial=new CommercialEntitlementService(durable.repositories);
await installSecurity(app,security,{beforeAuthorize:async target=>installCommercialControlPlane(target,commercial)});
await reconcileLegacyNorthstarCoreBootstrap(durable.pool,durable.context.tenantId);
app.use(async(req:SecurityRequest,res,next)=>{try{if(!req.path.startsWith('/api/'))return next();if(!req.identity)return res.status(401).json({error:'Authentication required.'});await commercial.checkAccess(req.identity,'NORTHSTAR_CORE');return next();}catch(error){if(error instanceof CommercialAccessError)return res.status(error.statusCode).json({error:error.message});return next(error);}});
app.get('/api/modules/:moduleKey/access',async(req:SecurityRequest,res,next)=>{try{const value=req.params.moduleKey;if(!(value in moduleCatalog))throw new CommercialAccessError(404,'Module is not registered.');res.json(await commercial.checkAccess(req.identity!,value as ModuleKey));}catch(error){next(error);}});
app.use((req:SecurityRequest,_res,next)=>req.identity?gatewayRequestContexts.run({tenantId:req.identity.tenantId,actorId:req.identity.userId,actorName:req.identity.name},next):next());
app.use((req:SecurityRequest,_res,next)=>{if(req.identity&&req.body&&typeof req.body==='object'){req.body.actorId=req.body.actorId||req.identity.userId;req.body.actorName=req.body.actorName||req.identity.name;req.body.recordedBy=req.body.recordedBy||req.identity.name;req.body.uploadedBy=req.body.uploadedBy||req.identity.name}next()});
installUatFoundation(app,{pool:durable.pool,audit:durable.repositories.audit});
installUatAttachments(app,{pool:durable.pool,objects:durable.objects,audit:durable.repositories.audit});
installCommunications(app,durable.pool,durable.objects);
const intakeWriters=new Set(['system-administrator','laboratory-administrator','tenant-owner','tenant-administrator','office-manager','customer-service','billing']);
app.use('/api/intake',(req:SecurityRequest,res,next)=>{if(!req.identity)return res.status(401).json({error:'Authentication required.'});if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!intakeWriters.has(req.identity.role))return res.status(403).json({error:'Permission denied.'});return next()});
installIntakeAdministration(app,{pool:durable.pool,audit:durable.repositories.audit});
installProductCatalogFoundation(app,durable.pool,durable.repositories.audit);
const legacyInternalHeaders=()=>({[internalTenantContextHeader]:issueInternalTenantContext({actorId:gatewayContext.actorId,actorName:gatewayContext.actorName,tenantId:gatewayContext.tenantId,laboratoryRole:gatewayContext.actorId==='system'?'system':'laboratory-user',platformRole:'none'})});
async function createOperationalCase(input:Record<string,unknown>){const response=await fetch(`${upstream}/api/cases`,{method:'POST',headers:{'Content-Type':'application/json',...legacyInternalHeaders()},body:JSON.stringify(input)});if(!response.ok)throw new Error(`Operational case creation failed: ${await response.text()}`);return response.json() as Promise<{id:string;caseNumber:string}>}
installDigitalIntake(app,{pool:durable.pool,objects:durable.objects,audit:durable.repositories.audit,context:gatewayContext,createOperationalCase});
async function listCases():Promise<ClinicalCase[]>{const response=await fetch(`${upstream}/api/cases`,{headers:legacyInternalHeaders()});if(!response.ok)throw new Error('Unable to load clinical cases.');return response.json() as Promise<ClinicalCase[]>}
async function fetchCase(caseId:string):Promise<ClinicalCase|null>{const response=await fetch(`${upstream}/api/cases/${caseId}`,{headers:legacyInternalHeaders()});return response.ok?response.json() as Promise<ClinicalCase>:null}
async function updateCase(caseId:string,value:ClinicalCase){const response=await fetch(`${upstream}/api/cases/${caseId}`,{method:'PUT',headers:{'Content-Type':'application/json','x-northstar-suppress-audit':'true',...legacyInternalHeaders()},body:JSON.stringify({patientId:value.patientId,practiceId:value.practiceId,doctorId:value.doctorId,status:value.status,toothNumbers:value.toothNumbers,arch:value.arch,restoration:value.restoration,material:value.material,shade:value.shade,stumpShade:value.stumpShade,rushPriority:value.rushPriority,receivedDate:value.receivedDate,prescriptionNotes:value.prescriptionNotes})});if(!response.ok)throw new Error('Unable to synchronize case state.')}
async function resolvePractice(id:string):Promise<Practice|null>{const response=await fetch(`${upstream}/api/practices`,{headers:legacyInternalHeaders()});if(!response.ok)return null;const practices=await response.json() as Practice[];return practices.find(item=>item.id===id)??null}
const qc=createQcEngine(app,now,fetchCase,updateCase,{repository:durable.repositories.qc,objects:durable.objects,audit:durable.repositories.audit,context:gatewayContext});
const billing=createBillingEngine(app,now,new LegacyFinancialRepositoryAdapter(durable,gatewayContext),resolvePractice,{audit:durable.repositories.audit,context:gatewayContext});
const shipping=createShippingEngine(app,now,listCases,updateCase,billing.invoiceShipment,{repository:durable.repositories.shipping,audit:durable.repositories.audit,context:gatewayContext});
app.get('/api/dashboard',async(_req,res)=>{const response=await fetch(`${upstream}/api/dashboard`,{headers:legacyInternalHeaders()});if(!response.ok)return res.status(response.status).send(await response.text());const snapshot=await response.json() as DashboardSnapshot;const metrics=await qc.metrics();const logistics=await shipping.metrics();const financial=await billing.metrics();const value:FinancialDashboardSnapshot={...snapshot,qcPassRate:metrics.passRate,qcRemakeRate:metrics.remakeRate,qcReworkRate:metrics.reworkRate,qcFirstPassYield:metrics.firstPassYield,qcDefectTrends:metrics.defectTrends,logistics,financial};return res.json(value)});
app.use(async(req:SecurityRequest,res)=>{if(!req.identity)return res.status(401).json({error:'Authentication required.'});if(req.identity.platformRole==='platform-admin')return res.status(403).json({error:'Platform administrators do not have tenant operational access.'});const headers=new Headers();for(const[key,value]of Object.entries(req.headers)){if(typeof value==='string'&&!['host','content-length','cookie','x-actor-id','x-actor-name','x-northstar-role','x-northstar-tenant','x-northstar-suppress-audit',internalTenantContextHeader].includes(key.toLowerCase()))headers.set(key,value)}headers.set(internalTenantContextHeader,issueInternalTenantContext({actorId:req.identity.userId,actorName:req.identity.name,tenantId:req.identity.tenantId,laboratoryRole:req.identity.role,platformRole:'none'}));const hasBody=!['GET','HEAD'].includes(req.method);const response=await fetch(`${upstream}${req.originalUrl}`,{method:req.method,headers,body:hasBody?JSON.stringify(req.body):undefined});res.status(response.status);response.headers.forEach((value,key)=>{if(key.toLowerCase()!=='content-encoding'&&key.toLowerCase()!=='content-length')res.setHeader(key,value)});return res.send(Buffer.from(await response.arrayBuffer()))});
app.use(commercialErrorHandler);
const server=app.listen(port,()=>console.log(`CADence NorthStar secure gateway listening on http://localhost:${port}`));
const shutdown=async()=>{server.close();await durable.pool.end()};
process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
