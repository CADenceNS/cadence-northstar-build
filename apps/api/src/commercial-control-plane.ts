import type { Express, NextFunction, Response } from 'express';
import type { CommercialEntitlementService, ModuleKey } from './infrastructure/commercial-entitlements.js';
import { CommercialAccessError, moduleCatalog } from './infrastructure/commercial-entitlements.js';
import type { SecurityRequest } from './security.js';

const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const moduleKey=(value:string):ModuleKey=>{if(!(value in moduleCatalog))throw new CommercialAccessError(400,'Unknown commercial module.');return value as ModuleKey;};
const actor=(req:SecurityRequest)=>({actorId:req.identity!.userId,actorName:req.identity!.name,platformRole:req.identity!.platformRole??'none'} as const);
const control=(handler:(req:SecurityRequest,res:Response)=>Promise<void>)=>(req:SecurityRequest,res:Response,next:NextFunction)=>void handler(req,res).catch(next);

export function installCommercialControlPlane(app:Express,commercial:CommercialEntitlementService){
  app.get('/api/commercial/tenants/:tenantId/entitlements',control(async(req,res)=>{if(actor(req).platformRole!=='platform-admin')throw new CommercialAccessError(403,'Platform commercial administration is required.');res.json(await commercial.repositories.commercial.listEntitlements(req.params.tenantId));}));
  app.get('/api/commercial/tenants/:tenantId/seat-pools',control(async(req,res)=>{if(actor(req).platformRole!=='platform-admin')throw new CommercialAccessError(403,'Platform commercial administration is required.');res.json(await commercial.repositories.commercial.listSeatPools(req.params.tenantId));}));
  app.put('/api/commercial/tenants/:tenantId/entitlements/:moduleKey',control(async(req,res)=>{const body=req.body as Record<string,unknown>;const state=text(body.state);if(state!=='ACTIVE'&&state!=='DISABLED')throw new CommercialAccessError(400,'Entitlement state must be ACTIVE or DISABLED.');const value=await commercial.grantOrDisable(actor(req),{tenantId:req.params.tenantId,moduleKey:moduleKey(req.params.moduleKey),state,effectiveFrom:text(body.effectiveFrom)||null,effectiveUntil:text(body.effectiveUntil)||null,metadata:body.metadata&&typeof body.metadata==='object'&&!Array.isArray(body.metadata)?body.metadata as Record<string,unknown>:{}});res.json(value);}));
  app.put('/api/commercial/tenants/:tenantId/seat-pools/:moduleKey',control(async(req,res)=>{const value=await commercial.setSeatPool(actor(req),req.params.tenantId,moduleKey(req.params.moduleKey),Number((req.body as Record<string,unknown>).purchasedSeatCount));res.json(value);}));
  app.post('/api/commercial/tenants/:tenantId/seat-assignments',control(async(req,res)=>{const body=req.body as Record<string,unknown>;const value=await commercial.assignSeat(actor(req),req.params.tenantId,moduleKey(text(body.moduleKey)),text(body.userId));res.status(201).json(value);}));
  app.delete('/api/commercial/tenants/:tenantId/seat-assignments/:moduleKey/:userId',control(async(req,res)=>{const value=await commercial.releaseSeat(actor(req),req.params.tenantId,moduleKey(req.params.moduleKey),req.params.userId);res.json(value);}));
}

export function commercialErrorHandler(error:unknown,_req:SecurityRequest,res:Response,next:NextFunction){if(error instanceof CommercialAccessError)return res.status(error.statusCode).json({error:error.message});return next(error);}
