import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { CommercialAccessError, CommercialEntitlementService } from './infrastructure/commercial-entitlements.js';
import { CommercialLicensingService } from './infrastructure/commercial-licensing.js';
import { createPostgresPool, PostgresRegistry } from './infrastructure/postgres.js';
import { DefaultPostgresRepositoryFactory } from './infrastructure/postgres-repositories.js';

const databaseUrl=process.env.DATABASE_URL;if(!databaseUrl)throw new Error('DATABASE_URL is required.');
const pool=createPostgresPool(databaseUrl),registry=new PostgresRegistry(pool,new DefaultPostgresRepositoryFactory());
const licensing=new CommercialLicensingService(registry),entitlements=new CommercialEntitlementService(registry);
const platform={actorId:'platform-admin',actorName:'CADence Platform Admin',platformRole:'platform-admin' as const};
const lab={actorId:'lab-admin',actorName:'Laboratory Admin',platformRole:'none' as const};
const rejected=(work:()=>Promise<unknown>)=>assert.rejects(work,(error:unknown)=>error instanceof CommercialAccessError&&error.statusCode===403);

try {
  const tenantA=await licensing.provision(platform,{name:'Activation Lab A',commercialAccountReference:`activation-a-${randomUUID()}`});
  const tenantB=await licensing.provision(platform,{name:'Activation Lab B',commercialAccountReference:`activation-b-${randomUUID()}`});
  await registry.memberships.save({tenantId:tenantA.id,userId:'lab-admin',laboratoryRole:'laboratory-administrator',platformRole:'none',status:'ACTIVE',locationIds:[],practiceIds:[],administrativeOverride:true});
  await registry.memberships.save({tenantId:tenantA.id,userId:'lab-user',laboratoryRole:'laboratory-staff',platformRole:'none',status:'ACTIVE',locationIds:[],practiceIds:[],administrativeOverride:false});
  await rejected(()=>licensing.issue(lab,tenantA.id));await rejected(()=>licensing.suspend(lab,tenantA.id,'self-service'));
  const first=await licensing.issue(platform,tenantA.id);assert.match(first.credential,/^act_[0-9a-f-]{36}\.[A-Za-z0-9_-]{20,}$/);assert.notEqual(first.credential,(await licensing.issue(platform,tenantB.id)).credential,'credentials use independent cryptographic randomness');
  const db=await pool.query<{secret_hash:string}>('SELECT secret_hash FROM tenant_activation_credentials WHERE id=$1',[first.record.id]);assert.equal(db.rows[0].secret_hash.includes(first.credential),false,'raw secret is not stored');
  await rejected(()=>licensing.activate(platform,tenantB.id,first.credential));await rejected(()=>licensing.activate(platform,tenantA.id,`${first.credential}x`));
  const activated=await licensing.activate(platform,tenantA.id,first.credential);assert.equal(activated.tenant.activationState,'ACTIVATED');await rejected(()=>licensing.activate(platform,tenantA.id,first.credential));
  await entitlements.grantOrDisable(platform,{tenantId:tenantA.id,moduleKey:'NORTHSTAR_CORE',state:'ACTIVE'});await entitlements.setSeatPool(platform,tenantA.id,'NORTHSTAR_CORE',1);await entitlements.assignSeat(platform,tenantA.id,'NORTHSTAR_CORE','lab-user');
  const identity={userId:'lab-user',name:'Lab User',email:'lab@example.test',role:'laboratory-administrator' as const,tenantId:tenantA.id,locationIds:[],practiceIds:[],administrativeOverride:false,sessionId:'session',csrfToken:'csrf',platformRole:'none' as const};assert.equal((await entitlements.checkAccess(identity,'NORTHSTAR_CORE')).tenantId,tenantA.id);
  const rotation=await licensing.rotate(platform,tenantA.id,first.record.id,'scheduled rotation');await rejected(()=>licensing.activate(platform,tenantA.id,first.credential));const rotated=await licensing.activate(platform,tenantA.id,rotation.credential);assert.equal(rotated.tenant.activationState,'ACTIVATED');
  await licensing.suspend(platform,tenantA.id,'nonpayment');assert.equal(await registry.tenants.getOperational(tenantA.id),null,'suspension blocks operations');assert.equal((await registry.memberships.get(tenantA.id,'lab-user'))?.status,'ACTIVE','suspension preserves membership');await rejected(()=>entitlements.checkAccess(identity,'NORTHSTAR_CORE'));
  await licensing.reactivate(platform,tenantA.id,'resolved');assert.equal((await registry.tenants.getOperational(tenantA.id))?.id,tenantA.id);assert.equal((await entitlements.checkAccess(identity,'NORTHSTAR_CORE')).module,'NORTHSTAR_CORE','reactivation does not mint new seats or entitlements');
  const current=(await licensing.inspect(platform,tenantA.id)).credentials.find(value=>value.id===rotation.record.id)!;await licensing.revoke(platform,tenantA.id,current.id,'license revoked');assert.equal((await registry.tenants.get(tenantA.id))?.activationState,'DEACTIVATED','active credential revocation disables the activation authorization');
  const third=await licensing.issue(platform,tenantA.id);await licensing.activate(platform,tenantA.id,third.credential);await licensing.cancel(platform,tenantA.id,'contract terminated');assert.equal((await registry.tenants.get(tenantA.id))?.status,'CANCELLED');assert.equal((await registry.commercial.getEntitlement(tenantA.id,'NORTHSTAR_CORE'))?.state,'ACTIVE','cancellation preserves module history');assert.equal((await registry.commercial.activeAssignment(tenantA.id,'NORTHSTAR_CORE','lab-user'))?.userId,'lab-user','cancellation preserves seat history');await assert.rejects(()=>licensing.reactivate(platform,tenantA.id,'not permitted'),(error:unknown)=>error instanceof CommercialAccessError&&error.statusCode===409);
  const events=await registry.audit.list(tenantA.id,'commercial-licensing');assert(events.some(event=>event.action==='commercial.activation.succeeded'));assert(events.some(event=>event.action==='commercial.tenant.suspended'));assert(events.some(event=>event.action==='commercial.tenant.cancelled'));assert.equal(JSON.stringify(events).includes(first.credential),false,'audit never contains raw activation secret');
  console.log('CF-1A3A activation licensing, lifecycle, secret safety, entitlement preservation, and commercial authorization tests passed.');
} finally {await pool.end();}
