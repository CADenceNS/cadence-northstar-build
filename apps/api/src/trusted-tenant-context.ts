import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { RepositoryContext } from './infrastructure/contracts.js';

/**
 * The only assertion accepted by the legacy operational runtime. It is created
 * after gateway session authentication; a browser can neither select nor mint it.
 */
export const internalTenantContextHeader='x-northstar-internal-context';
const audience='northstar-operational-runtime',defaultTtlSeconds=30;
export type PlatformRole='none'|'platform-admin';
export interface TrustedTenantContext extends RepositoryContext { laboratoryRole:string; platformRole:PlatformRole; expiresAt:number; }
type AssertionPayload=TrustedTenantContext&{audience:string};

function secret(){
  const configured=process.env.NORTHSTAR_INTERNAL_CONTEXT_SECRET;
  if(configured){if(configured.length<32)throw new Error('NORTHSTAR_INTERNAL_CONTEXT_SECRET must contain at least 32 characters.');return configured}
  if(process.env.NODE_ENV==='production')throw new Error('NORTHSTAR_INTERNAL_CONTEXT_SECRET is required in production.');
  const key='__cadenceNorthstarInternalContextSecret';const state=globalThis as typeof globalThis&{[key:string]:string|undefined};
  return state[key]??(state[key]=randomBytes(32).toString('base64url'));
}
const encoded=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
const signature=(body:string)=>createHmac('sha256',secret()).update(body).digest('base64url');

export function issueInternalTenantContext(input:Omit<TrustedTenantContext,'expiresAt'>,ttlSeconds=defaultTtlSeconds){
  if(input.platformRole!=='none')throw new Error('Platform administrators do not receive tenant operational context.');
  if(!input.actorId||!input.tenantId||!input.laboratoryRole)throw new Error('A complete authenticated tenant context is required.');
  const body=encoded({...input,audience,expiresAt:Math.floor(Date.now()/1000)+ttlSeconds});return `${body}.${signature(body)}`;
}

export function resolveInternalTenantContext(value:string|undefined):TrustedTenantContext|null{
  if(!value)return null;const[body,provided,extra]=value.split('.');if(!body||!provided||extra)return null;
  const expected=signature(body),providedBytes=Buffer.from(provided),expectedBytes=Buffer.from(expected);
  if(providedBytes.length!==expectedBytes.length||!timingSafeEqual(providedBytes,expectedBytes))return null;
  try{const payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8')) as AssertionPayload;
    if(payload.audience!==audience||payload.platformRole!=='none'||!payload.actorId||!payload.actorName||!payload.tenantId||!payload.laboratoryRole||!Number.isInteger(payload.expiresAt)||payload.expiresAt<Math.floor(Date.now()/1000))return null;
    return Object.freeze({actorId:payload.actorId,actorName:payload.actorName,tenantId:payload.tenantId,laboratoryRole:payload.laboratoryRole,platformRole:'none',expiresAt:payload.expiresAt});
  }catch{return null}
}

export function trustedTenantContextMiddleware(run:(context:RepositoryContext,callback:()=>void)=>void):RequestHandler{
  return (req,res,next)=>{const context=resolveInternalTenantContext(req.header(internalTenantContextHeader));if(!context)return res.status(401).json({error:'Trusted authenticated tenant context is required.'});return run(context,next)};
}
