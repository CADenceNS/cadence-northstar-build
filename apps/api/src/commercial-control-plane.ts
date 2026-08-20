import type { Express, NextFunction, Response } from 'express';
import type { CommercialEntitlementService, ModuleKey } from './infrastructure/commercial-entitlements.js';
import { CommercialAccessError, moduleCatalog } from './infrastructure/commercial-entitlements.js';
import type { CommercialLicensingService } from './infrastructure/commercial-licensing.js';
import type { SecurityRequest } from './security.js';

const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const moduleKey=(value:string):ModuleKey=>{if(!(value in moduleCatalog))throw new CommercialAccessError(400,'Unknown commercial module.');return value as ModuleKey;};
const actor=(req:SecurityRequest)=>({actorId:req.identity!.userId,actorName:req.identity!.name,platformRole:req.identity!.platformRole??'none'} as const);
const control=(handler:(req:SecurityRequest,res:Response)=>Promise<void>)=>(req:SecurityRequest,res:Response,next:NextFunction)=>void handler(req,res).catch(next);
const commercialAuditTypes=['commercial-licensing','commercial-entitlement','commercial-seat-pool','commercial-seat-assignment'] as const;
const secretKey=/^(credential|rawcredential|secret|secrethash|token|csrftoken)$/i;
function safeMetadata(value:unknown):unknown{
  if(Array.isArray(value))return value.map(safeMetadata);
  if(value&&typeof value==='object'){
    const safe:Record<string,unknown>={};
    for(const [key,item] of Object.entries(value as Record<string,unknown>))if(!secretKey.test(key))safe[key]=safeMetadata(item);
    return safe;
  }
  return value;
}
function requirePlatform(req:SecurityRequest){if(actor(req).platformRole!=='platform-admin')throw new CommercialAccessError(403,'Platform commercial administration is required.');}

export function installCommercialControlPlane(app:Express,services:{commercial:CommercialEntitlementService;licensing:CommercialLicensingService}){
  const {commercial,licensing}=services;
  app.get('/api/commercial/tenants',control(async(req,res)=>{
    requirePlatform(req);
    const tenants=await commercial.repositories.tenants.list();
    const rows=await Promise.all(tenants.map(async tenant=>({
      tenant,
      entitlements:await commercial.repositories.commercial.listEntitlements(tenant.id),
      seatPools:await commercial.repositories.commercial.listSeatPools(tenant.id)
    })));
    res.json(rows);
  }));
  app.post('/api/commercial/tenants',control(async(req,res)=>{const body=req.body as Record<string,unknown>;res.status(201).json(await licensing.provision(actor(req),{name:text(body.name),commercialAccountReference:text(body.commercialAccountReference)}));}));
  app.get('/api/commercial/tenants/:tenantId',control(async(req,res)=>{res.json(await licensing.inspect(actor(req),req.params.tenantId));}));
  app.get('/api/commercial/tenants/:tenantId/audit',control(async(req,res)=>{
    requirePlatform(req);
    await licensing.inspect(actor(req),req.params.tenantId);
    const events=(await Promise.all(commercialAuditTypes.map(type=>commercial.repositories.audit.list(req.params.tenantId,type)))).flat()
      .sort((left,right)=>right.occurredAt.localeCompare(left.occurredAt))
      .map(event=>({...event,metadata:safeMetadata(event.metadata) as Record<string,unknown>}));
    res.json(events);
  }));
  app.get('/api/commercial/tenants/:tenantId/activation-credentials',control(async(req,res)=>{res.json((await licensing.inspect(actor(req),req.params.tenantId)).credentials);}));
  app.post('/api/commercial/tenants/:tenantId/activation-credentials',control(async(req,res)=>{const body=req.body as Record<string,unknown>;res.status(201).json(await licensing.issue(actor(req),req.params.tenantId,{expiresAt:text(body.expiresAt)||undefined,reason:text(body.reason)||undefined}));}));
  app.post('/api/commercial/tenants/:tenantId/activate',control(async(req,res)=>{const body=req.body as Record<string,unknown>;res.json(await licensing.activate(actor(req),req.params.tenantId,text(body.credential)));}));
  app.post('/api/commercial/tenants/:tenantId/activation-credentials/:credentialId/revoke',control(async(req,res)=>{const body=req.body as Record<string,unknown>;res.json(await licensing.revoke(actor(req),req.params.tenantId,req.params.credentialId,text(body.reason)));}));
  app.post('/api/commercial/tenants/:tenantId/activation-credentials/:credentialId/rotate',control(async(req,res)=>{const body=req.body as Record<string,unknown>;res.json(await licensing.rotate(actor(req),req.params.tenantId,req.params.credentialId,text(body.reason)));}));
  app.post('/api/commercial/tenants/:tenantId/suspend',control(async(req,res)=>{const body=req.body as Record<string,unknown>;res.json(await licensing.suspend(actor(req),req.params.tenantId,text(body.reason)));}));
  app.post('/api/commercial/tenants/:tenantId/reactivate',control(async(req,res)=>{const body=req.body as Record<string,unknown>;res.json(await licensing.reactivate(actor(req),req.params.tenantId,text(body.reason)));}));
  app.post('/api/commercial/tenants/:tenantId/cancel',control(async(req,res)=>{const body=req.body as Record<string,unknown>;res.json(await licensing.cancel(actor(req),req.params.tenantId,text(body.reason)));}));
  app.get('/api/commercial/tenants/:tenantId/entitlements',control(async(req,res)=>{if(actor(req).platformRole!=='platform-admin')throw new CommercialAccessError(403,'Platform commercial administration is required.');res.json(await commercial.repositories.commercial.listEntitlements(req.params.tenantId));}));
  app.get('/api/commercial/tenants/:tenantId/seat-pools',control(async(req,res)=>{if(actor(req).platformRole!=='platform-admin')throw new CommercialAccessError(403,'Platform commercial administration is required.');res.json(await commercial.repositories.commercial.listSeatPools(req.params.tenantId));}));
  app.put('/api/commercial/tenants/:tenantId/entitlements/:moduleKey',control(async(req,res)=>{const body=req.body as Record<string,unknown>;const state=text(body.state);if(state!=='ACTIVE'&&state!=='DISABLED')throw new CommercialAccessError(400,'Entitlement state must be ACTIVE or DISABLED.');const value=await commercial.grantOrDisable(actor(req),{tenantId:req.params.tenantId,moduleKey:moduleKey(req.params.moduleKey),state,effectiveFrom:text(body.effectiveFrom)||null,effectiveUntil:text(body.effectiveUntil)||null,metadata:body.metadata&&typeof body.metadata==='object'&&!Array.isArray(body.metadata)?body.metadata as Record<string,unknown>:{}});res.json(value);}));
  app.put('/api/commercial/tenants/:tenantId/seat-pools/:moduleKey',control(async(req,res)=>{const value=await commercial.setSeatPool(actor(req),req.params.tenantId,moduleKey(req.params.moduleKey),Number((req.body as Record<string,unknown>).purchasedSeatCount));res.json(value);}));
  app.post('/api/commercial/tenants/:tenantId/seat-assignments',control(async(req,res)=>{const body=req.body as Record<string,unknown>;const value=await commercial.assignSeat(actor(req),req.params.tenantId,moduleKey(text(body.moduleKey)),text(body.userId));res.status(201).json(value);}));
  app.delete('/api/commercial/tenants/:tenantId/seat-assignments/:moduleKey/:userId',control(async(req,res)=>{const value=await commercial.releaseSeat(actor(req),req.params.tenantId,moduleKey(req.params.moduleKey),req.params.userId);res.json(value);}));
}

export function commercialErrorHandler(error:unknown,_req:SecurityRequest,res:Response,next:NextFunction){if(error instanceof CommercialAccessError)return res.status(error.statusCode).json({error:error.message});return next(error);}
