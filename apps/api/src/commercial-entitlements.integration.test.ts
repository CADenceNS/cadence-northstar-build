import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { CommercialAccessError, CommercialEntitlementService } from './infrastructure/commercial-entitlements.js';
import { createPostgresPool, PostgresRegistry } from './infrastructure/postgres.js';
import { DefaultPostgresRepositoryFactory } from './infrastructure/postgres-repositories.js';

const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error('DATABASE_URL is required.');
const pool=createPostgresPool(databaseUrl),registry=new PostgresRegistry(pool,new DefaultPostgresRepositoryFactory());
const service=new CommercialEntitlementService(registry);
const tenantA=randomUUID(),tenantB=randomUUID();
const platform={actorId:'platform-admin',actorName:'CADence Platform Admin',platformRole:'platform-admin' as const};
const member=(tenantId:string,userId:string,platformRole:'none'|'platform-admin'='none')=>registry.memberships.save({tenantId,userId,laboratoryRole:platformRole==='none'?'laboratory-administrator':'system-administrator',platformRole,status:'ACTIVE',locationIds:[],practiceIds:[],administrativeOverride:true});
const identity=(tenantId:string,userId:string)=>({userId,name:userId,email:`${userId}@example.test`,role:'laboratory-administrator' as const,tenantId,locationIds:[],practiceIds:[],administrativeOverride:true,sessionId:'test-session',csrfToken:'test-csrf',platformRole:'none' as const});
const denied=async(work:()=>Promise<unknown>,message:RegExp)=>await assert.rejects(work,(error:unknown)=>error instanceof CommercialAccessError&&error.statusCode===403&&message.test(error.message));

try {
  await registry.tenants.create({id:tenantA,name:'Laboratory A',status:'ACTIVE',activationState:'ACTIVATED',commercialAccountReference:'acct-a',auditMetadata:{test:'commercial-entitlements'}});
  await registry.tenants.create({id:tenantB,name:'Laboratory B',status:'ACTIVE',activationState:'ACTIVATED',commercialAccountReference:'acct-b',auditMetadata:{test:'commercial-entitlements'}});
  for(const userId of['a-owner','a-1','a-2','a-3','a-4'])await member(tenantA,userId);
  await member(tenantA,'platform-admin','platform-admin');await member(tenantB,'b-owner');

  await service.grantOrDisable(platform,{tenantId:tenantA,moduleKey:'NORTHSTAR_CORE',state:'ACTIVE'});
  await service.grantOrDisable(platform,{tenantId:tenantA,moduleKey:'DESIGN_STUDIO',state:'ACTIVE'});
  await service.grantOrDisable(platform,{tenantId:tenantA,moduleKey:'GVM',state:'DISABLED'});
  await service.grantOrDisable(platform,{tenantId:tenantB,moduleKey:'NORTHSTAR_CORE',state:'ACTIVE'});
  await service.setSeatPool(platform,tenantA,'NORTHSTAR_CORE',20);
  await service.setSeatPool(platform,tenantA,'DESIGN_STUDIO',3);
  await service.setSeatPool(platform,tenantA,'GVM',1);
  await service.setSeatPool(platform,tenantB,'NORTHSTAR_CORE',1);

  for(const userId of['a-owner','a-1','a-2','a-3','a-4'])await service.assignSeat(platform,tenantA,'NORTHSTAR_CORE',userId);
  for(const userId of['a-owner','a-1','a-2'])await service.assignSeat(platform,tenantA,'DESIGN_STUDIO',userId);
  const northstar=await registry.commercial.getSeatPool(tenantA,'NORTHSTAR_CORE');const designStudio=await registry.commercial.getSeatPool(tenantA,'DESIGN_STUDIO');
  assert.deepEqual({purchased:northstar?.purchasedSeatCount,assigned:northstar?.assignedSeatCount,available:northstar?.availableSeatCount},{purchased:20,assigned:5,available:15});
  assert.deepEqual({purchased:designStudio?.purchasedSeatCount,assigned:designStudio?.assignedSeatCount,available:designStudio?.availableSeatCount},{purchased:3,assigned:3,available:0});
  await assert.rejects(()=>service.assignSeat(platform,tenantA,'DESIGN_STUDIO','a-3'),(error:unknown)=>error instanceof CommercialAccessError&&error.statusCode===409);
  await assert.rejects(()=>service.assignSeat(platform,tenantA,'DESIGN_STUDIO','b-owner'),(error:unknown)=>error instanceof CommercialAccessError&&error.statusCode===403);
  await assert.rejects(()=>service.assignSeat(platform,tenantA,'NORTHSTAR_CORE','platform-admin'),(error:unknown)=>error instanceof CommercialAccessError&&error.statusCode===403);

  assert.equal((await service.checkAccess(identity(tenantA,'a-owner'),'NORTHSTAR_CORE')).module,'NORTHSTAR_CORE');
  assert.equal((await service.checkAccess(identity(tenantA,'a-owner'),'DESIGN_STUDIO')).module,'DESIGN_STUDIO');
  await service.grantOrDisable(platform,{tenantId:tenantA,moduleKey:'DESIGN_STUDIO',state:'DISABLED'});
  await denied(()=>service.checkAccess(identity(tenantA,'a-owner'),'DESIGN_STUDIO'),/not active/);
  assert.equal((await registry.commercial.activeAssignment(tenantA,'DESIGN_STUDIO','a-owner'))?.userId,'a-owner','disabling preserves seat history and assignment');
  await service.grantOrDisable(platform,{tenantId:tenantA,moduleKey:'DESIGN_STUDIO',state:'ACTIVE'});
  assert.equal((await service.checkAccess(identity(tenantA,'a-owner'),'DESIGN_STUDIO')).module,'DESIGN_STUDIO','re-enabling restores authorized access');
  await service.releaseSeat(platform,tenantA,'DESIGN_STUDIO','a-2');
  await service.assignSeat(platform,tenantA,'DESIGN_STUDIO','a-3');
  assert.equal((await service.checkAccess(identity(tenantA,'a-3'),'DESIGN_STUDIO')).module,'DESIGN_STUDIO','released Design Studio seat is reassigned without changing NorthStar capacity');
  await service.grantOrDisable(platform,{tenantId:tenantA,moduleKey:'GVM',state:'ACTIVE'});
  await service.assignSeat(platform,tenantA,'GVM','a-owner');
  assert.equal((await service.checkAccess(identity(tenantA,'a-owner'),'GVM')).module,'GVM','GVM is an entitlement domain without an operational module route');
  await service.grantOrDisable(platform,{tenantId:tenantA,moduleKey:'NORTHSTAR_CORE',state:'DISABLED'});
  await denied(()=>service.checkAccess(identity(tenantA,'a-owner'),'NORTHSTAR_CORE'),/not active/);
  await denied(()=>service.checkAccess({...identity(tenantA,'platform-admin'),platformRole:'platform-admin'},'DESIGN_STUDIO'),/Platform administrators/);
  const events=await registry.audit.list(tenantA,'commercial-seat-assignment');
  assert(events.some(event=>event.action==='commercial.seat.assigned'&&event.metadata.newState),'seat assignment audit records a new state');
  assert(events.some(event=>event.action==='commercial.seat.released'&&event.metadata.previousState),'seat release audit records a previous state');
  console.log('CF-1A2 commercial entitlement, seat, isolation, disable/re-enable, and audit tests passed.');
} finally { await pool.end(); }
