import type { RequestIdentity } from '../security.js';
import type { AuditEventInput, RepositoryRegistry } from './contracts.js';
import type { SqlExecutor } from './postgres.js';

export type ModuleKey='NORTHSTAR_CORE'|'DESIGN_STUDIO'|'GVM';
export const LEGACY_NORTHSTAR_TENANT_ID='00000000-0000-0000-0000-000000000001';
export const moduleCatalog:Readonly<Record<ModuleKey,{readonly key:ModuleKey;readonly requires:ReadonlyArray<ModuleKey>}>>=Object.freeze({
  NORTHSTAR_CORE:Object.freeze({key:'NORTHSTAR_CORE' as ModuleKey,requires:Object.freeze([]) as ReadonlyArray<ModuleKey>}),
  DESIGN_STUDIO:Object.freeze({key:'DESIGN_STUDIO' as ModuleKey,requires:Object.freeze(['NORTHSTAR_CORE'] as ModuleKey[])}),
  GVM:Object.freeze({key:'GVM' as ModuleKey,requires:Object.freeze(['NORTHSTAR_CORE'] as ModuleKey[])})
});
export type EntitlementState='ACTIVE'|'DISABLED';

export interface ModuleEntitlement { tenantId:string;moduleKey:ModuleKey;state:EntitlementState;effectiveFrom:string|null;effectiveUntil:string|null;source:string;metadata:Record<string,unknown>;createdAt:string;updatedAt:string; }
export interface ModuleSeatPool { tenantId:string;moduleKey:ModuleKey;purchasedSeatCount:number;assignedSeatCount:number;availableSeatCount:number; }
export interface ModuleSeatAssignment { id:string;tenantId:string;moduleKey:ModuleKey;userId:string;assignedBy:string;assignedAt:string;releasedBy:string|null;releasedAt:string|null;metadata:Record<string,unknown>; }
export interface CommercialActor { actorId:string;actorName:string;platformRole:'none'|'platform-admin'; }
export interface ActivationCredential {id:string;tenantId:string;secretHash:string;issuedBy:string;issuedAt:string;expiresAt:string;activatedAt:string|null;activatedBy:string|null;revokedAt:string|null;revokedBy:string|null;revocationReason:string|null;supersedesCredentialId:string|null;replacedByCredentialId:string|null;metadata:Record<string,unknown>;}

type EntitlementRow={tenant_id:string;module_key:string;state:EntitlementState;effective_from:Date|null;effective_until:Date|null;source:string;metadata:Record<string,unknown>;created_at:Date;updated_at:Date};
type PoolRow={tenant_id:string;module_key:string;purchased_seat_count:number;assigned_seat_count:number};
type AssignmentRow={id:string;tenant_id:string;module_key:string;user_id:string;assigned_by:string;assigned_at:Date;released_by:string|null;released_at:Date|null;metadata:Record<string,unknown>};
type CredentialRow={id:string;tenant_id:string;secret_hash:string;issued_by:string;issued_at:Date;expires_at:Date;activated_at:Date|null;activated_by:string|null;revoked_at:Date|null;revoked_by:string|null;revocation_reason:string|null;supersedes_credential_id:string|null;replaced_by_credential_id:string|null;metadata:Record<string,unknown>};

function moduleKey(value:string):ModuleKey { if(!(value in moduleCatalog))throw new CommercialAccessError(400,'Unknown commercial module.'); return value as ModuleKey; }
function entitlement(row:EntitlementRow):ModuleEntitlement{return Object.freeze({tenantId:row.tenant_id,moduleKey:moduleKey(row.module_key),state:row.state,effectiveFrom:row.effective_from?.toISOString()??null,effectiveUntil:row.effective_until?.toISOString()??null,source:row.source,metadata:Object.freeze({...row.metadata}),createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString()});}
function pool(row:PoolRow):ModuleSeatPool{return Object.freeze({tenantId:row.tenant_id,moduleKey:moduleKey(row.module_key),purchasedSeatCount:row.purchased_seat_count,assignedSeatCount:Number(row.assigned_seat_count),availableSeatCount:Math.max(0,row.purchased_seat_count-Number(row.assigned_seat_count))});}
function assignment(row:AssignmentRow):ModuleSeatAssignment{return Object.freeze({id:row.id,tenantId:row.tenant_id,moduleKey:moduleKey(row.module_key),userId:row.user_id,assignedBy:row.assigned_by,assignedAt:row.assigned_at.toISOString(),releasedBy:row.released_by,releasedAt:row.released_at?.toISOString()??null,metadata:Object.freeze({...row.metadata})});}
function credential(row:CredentialRow):ActivationCredential{return Object.freeze({id:row.id,tenantId:row.tenant_id,secretHash:row.secret_hash,issuedBy:row.issued_by,issuedAt:row.issued_at.toISOString(),expiresAt:row.expires_at.toISOString(),activatedAt:row.activated_at?.toISOString()??null,activatedBy:row.activated_by,revokedAt:row.revoked_at?.toISOString()??null,revokedBy:row.revoked_by,revocationReason:row.revocation_reason,supersedesCredentialId:row.supersedes_credential_id,replacedByCredentialId:row.replaced_by_credential_id,metadata:Object.freeze({...row.metadata})});}
function effective(value:ModuleEntitlement,at=new Date()){return value.state==='ACTIVE'&&(!value.effectiveFrom||new Date(value.effectiveFrom)<=at)&&(!value.effectiveUntil||new Date(value.effectiveUntil)>at);}

export class CommercialAccessError extends Error { constructor(public readonly statusCode:number,message:string){super(message);} }

export class PostgresCommercialRepository {
  constructor(private readonly db:SqlExecutor){}

  async getEntitlement(tenantId:string,key:ModuleKey){const result=await this.db.query<EntitlementRow>('SELECT tenant_id::text,module_key,state,effective_from,effective_until,source,metadata,created_at,updated_at FROM tenant_module_entitlements WHERE tenant_id=$1 AND module_key=$2',[tenantId,key]);return result.rows[0]?entitlement(result.rows[0]):null;}
  async listEntitlements(tenantId:string){const result=await this.db.query<EntitlementRow>('SELECT tenant_id::text,module_key,state,effective_from,effective_until,source,metadata,created_at,updated_at FROM tenant_module_entitlements WHERE tenant_id=$1 ORDER BY module_key',[tenantId]);return result.rows.map(entitlement);}
  async setEntitlement(value:Pick<ModuleEntitlement,'tenantId'|'moduleKey'|'state'|'effectiveFrom'|'effectiveUntil'|'source'|'metadata'>){
    await this.db.query(`INSERT INTO tenant_module_entitlements(tenant_id,module_key,state,effective_from,effective_until,source,metadata) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)
      ON CONFLICT(tenant_id,module_key) DO UPDATE SET state=EXCLUDED.state,effective_from=EXCLUDED.effective_from,effective_until=EXCLUDED.effective_until,source=EXCLUDED.source,metadata=EXCLUDED.metadata,updated_at=now()`,[value.tenantId,value.moduleKey,value.state,value.effectiveFrom,value.effectiveUntil,value.source,JSON.stringify(value.metadata)]);
    return this.getEntitlement(value.tenantId,value.moduleKey);
  }
  async getSeatPool(tenantId:string,key:ModuleKey,lock=false){if(lock)await this.db.query('SELECT 1 FROM tenant_module_seat_pools WHERE tenant_id=$1 AND module_key=$2 FOR UPDATE',[tenantId,key]);const result=await this.db.query<PoolRow>('SELECT p.tenant_id::text,p.module_key,p.purchased_seat_count,COUNT(a.id)::integer AS assigned_seat_count FROM tenant_module_seat_pools p LEFT JOIN tenant_module_seat_assignments a ON a.tenant_id=p.tenant_id AND a.module_key=p.module_key AND a.released_at IS NULL WHERE p.tenant_id=$1 AND p.module_key=$2 GROUP BY p.tenant_id,p.module_key,p.purchased_seat_count',[tenantId,key]);return result.rows[0]?pool(result.rows[0]):null;}
  async listSeatPools(tenantId:string){const result=await this.db.query<PoolRow>('SELECT p.tenant_id::text,p.module_key,p.purchased_seat_count,COUNT(a.id)::integer AS assigned_seat_count FROM tenant_module_seat_pools p LEFT JOIN tenant_module_seat_assignments a ON a.tenant_id=p.tenant_id AND a.module_key=p.module_key AND a.released_at IS NULL WHERE p.tenant_id=$1 GROUP BY p.tenant_id,p.module_key,p.purchased_seat_count ORDER BY p.module_key',[tenantId]);return result.rows.map(pool);}
  async setSeatPool(tenantId:string,key:ModuleKey,purchasedSeatCount:number){if(!Number.isSafeInteger(purchasedSeatCount)||purchasedSeatCount<0)throw new CommercialAccessError(400,'Seat count must be a non-negative integer.');await this.db.query(`INSERT INTO tenant_module_seat_pools(tenant_id,module_key,purchased_seat_count,source) VALUES($1,$2,$3,'commercial-control-plane') ON CONFLICT(tenant_id,module_key) DO UPDATE SET purchased_seat_count=EXCLUDED.purchased_seat_count,source=EXCLUDED.source,updated_at=now()`,[tenantId,key,purchasedSeatCount]);return this.getSeatPool(tenantId,key);}
  async activeAssignment(tenantId:string,key:ModuleKey,userId:string,lock=false){const result=await this.db.query<AssignmentRow>(`SELECT id::text,tenant_id::text,module_key,user_id,assigned_by,assigned_at,released_by,released_at,metadata FROM tenant_module_seat_assignments WHERE tenant_id=$1 AND module_key=$2 AND user_id=$3 AND released_at IS NULL${lock?' FOR UPDATE':''}`,[tenantId,key,userId]);return result.rows[0]?assignment(result.rows[0]):null;}
  async assignSeat(tenantId:string,key:ModuleKey,userId:string,actorId:string,metadata:Record<string,unknown>={}){const result=await this.db.query<AssignmentRow>('INSERT INTO tenant_module_seat_assignments(tenant_id,module_key,user_id,assigned_by,metadata) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING id::text,tenant_id::text,module_key,user_id,assigned_by,assigned_at,released_by,released_at,metadata',[tenantId,key,userId,actorId,JSON.stringify(metadata)]);return assignment(result.rows[0]);}
  async releaseSeat(tenantId:string,key:ModuleKey,userId:string,actorId:string){const result=await this.db.query<AssignmentRow>(`UPDATE tenant_module_seat_assignments SET released_by=$4,released_at=now() WHERE tenant_id=$1 AND module_key=$2 AND user_id=$3 AND released_at IS NULL RETURNING id::text,tenant_id::text,module_key,user_id,assigned_by,assigned_at,released_by,released_at,metadata`,[tenantId,key,userId,actorId]);return result.rows[0]?assignment(result.rows[0]):null;}
  async getActivationCredential(id:string){const result=await this.db.query<CredentialRow>('SELECT id::text,tenant_id::text,secret_hash,issued_by,issued_at,expires_at,activated_at,activated_by,revoked_at,revoked_by,revocation_reason,supersedes_credential_id::text,replaced_by_credential_id::text,metadata FROM tenant_activation_credentials WHERE id=$1',[id]);return result.rows[0]?credential(result.rows[0]):null;}
  async listActivationCredentials(tenantId:string){const result=await this.db.query<CredentialRow>('SELECT id::text,tenant_id::text,secret_hash,issued_by,issued_at,expires_at,activated_at,activated_by,revoked_at,revoked_by,revocation_reason,supersedes_credential_id::text,replaced_by_credential_id::text,metadata FROM tenant_activation_credentials WHERE tenant_id=$1 ORDER BY issued_at DESC',[tenantId]);return result.rows.map(credential);}
  async createActivationCredential(value:Pick<ActivationCredential,'id'|'tenantId'|'secretHash'|'issuedBy'|'expiresAt'|'supersedesCredentialId'|'metadata'>){const result=await this.db.query<CredentialRow>('INSERT INTO tenant_activation_credentials(id,tenant_id,secret_hash,issued_by,expires_at,supersedes_credential_id,metadata) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id::text,tenant_id::text,secret_hash,issued_by,issued_at,expires_at,activated_at,activated_by,revoked_at,revoked_by,revocation_reason,supersedes_credential_id::text,replaced_by_credential_id::text,metadata',[value.id,value.tenantId,value.secretHash,value.issuedBy,value.expiresAt,value.supersedesCredentialId,JSON.stringify(value.metadata)]);return credential(result.rows[0]);}
  async activateCredential(id:string,actorId:string){const result=await this.db.query<CredentialRow>('UPDATE tenant_activation_credentials SET activated_at=now(),activated_by=$2 WHERE id=$1 AND activated_at IS NULL AND revoked_at IS NULL AND expires_at>now() RETURNING id::text,tenant_id::text,secret_hash,issued_by,issued_at,expires_at,activated_at,activated_by,revoked_at,revoked_by,revocation_reason,supersedes_credential_id::text,replaced_by_credential_id::text,metadata',[id,actorId]);return result.rows[0]?credential(result.rows[0]):null;}
  async revokeActivationCredential(id:string,actorId:string,reason:string|null,replacedByCredentialId:string|null=null){const result=await this.db.query<CredentialRow>('UPDATE tenant_activation_credentials SET revoked_at=COALESCE(revoked_at,now()),revoked_by=COALESCE(revoked_by,$2),revocation_reason=COALESCE(revocation_reason,$3),replaced_by_credential_id=COALESCE(replaced_by_credential_id,$4) WHERE id=$1 RETURNING id::text,tenant_id::text,secret_hash,issued_by,issued_at,expires_at,activated_at,activated_by,revoked_at,revoked_by,revocation_reason,supersedes_credential_id::text,replaced_by_credential_id::text,metadata',[id,actorId,reason,replacedByCredentialId]);return result.rows[0]?credential(result.rows[0]):null;}
}

export class CommercialEntitlementService {
  constructor(readonly repositories:RepositoryRegistry){}

  private audit(tenantId:string,actor:CommercialActor,action:string,entityId:string,previousState:unknown,newState:unknown){return this.repositories.audit.append({tenantId,actorId:actor.actorId,actorName:actor.actorName,action,entityType:'commercial-entitlement',entityId,occurredAt:new Date().toISOString(),metadata:{previousState,newState}} satisfies AuditEventInput);}
  private requirePlatform(actor:CommercialActor){if(actor.platformRole!=='platform-admin')throw new CommercialAccessError(403,'Platform commercial administration is required.');}
  private async requireDependencies(tenantId:string,key:ModuleKey){for(const dependency of moduleCatalog[key].requires){const value=await this.repositories.commercial.getEntitlement(tenantId,dependency);if(!value||!effective(value))throw new CommercialAccessError(403,`${dependency} entitlement is required.`);}}
  private async requireActiveEntitlement(tenantId:string,key:ModuleKey){await this.requireDependencies(tenantId,key);const value=await this.repositories.commercial.getEntitlement(tenantId,key);if(!value||!effective(value))throw new CommercialAccessError(403,`${key} entitlement is not active.`);return value;}

  async grantOrDisable(actor:CommercialActor,input:{tenantId:string;moduleKey:ModuleKey;state:EntitlementState;effectiveFrom?:string|null;effectiveUntil?:string|null;metadata?:Record<string,unknown>}){
    this.requirePlatform(actor);if(input.state==='ACTIVE')await this.requireDependencies(input.tenantId,input.moduleKey);
    return this.repositories.transaction(async repositories=>{
      const previous=await repositories.commercial.getEntitlement(input.tenantId,input.moduleKey);
      const next=await repositories.commercial.setEntitlement({tenantId:input.tenantId,moduleKey:input.moduleKey,state:input.state,effectiveFrom:input.effectiveFrom??null,effectiveUntil:input.effectiveUntil??null,source:'commercial-control-plane',metadata:input.metadata??{}});
      await repositories.audit.append({tenantId:input.tenantId,actorId:actor.actorId,actorName:actor.actorName,action:input.state==='ACTIVE'?'commercial.entitlement.enabled':'commercial.entitlement.disabled',entityType:'commercial-entitlement',entityId:input.moduleKey,occurredAt:new Date().toISOString(),metadata:{previousState:previous,newState:next}});
      return next!;
    });
  }

  async setSeatPool(actor:CommercialActor,tenantId:string,key:ModuleKey,purchasedSeatCount:number){this.requirePlatform(actor);return this.repositories.transaction(async repositories=>{const previous=await repositories.commercial.getSeatPool(tenantId,key);if(previous&&purchasedSeatCount<previous.assignedSeatCount)throw new CommercialAccessError(409,'Seat pool cannot be reduced below active assignments.');const next=await repositories.commercial.setSeatPool(tenantId,key,purchasedSeatCount);await repositories.audit.append({tenantId,actorId:actor.actorId,actorName:actor.actorName,action:'commercial.seat-limit.changed',entityType:'commercial-seat-pool',entityId:key,occurredAt:new Date().toISOString(),metadata:{previousState:previous,newState:next}});return next!;});}

  async assignSeat(actor:CommercialActor,tenantId:string,key:ModuleKey,userId:string){this.requirePlatform(actor);return this.repositories.transaction(async repositories=>{
      const entitlementValue=await repositories.commercial.getEntitlement(tenantId,key);if(!entitlementValue||!effective(entitlementValue))throw new CommercialAccessError(403,`${key} entitlement is not active.`);
      for(const dependency of moduleCatalog[key].requires){const dependencyValue=await repositories.commercial.getEntitlement(tenantId,dependency);if(!dependencyValue||!effective(dependencyValue))throw new CommercialAccessError(403,`${dependency} entitlement is required.`);}
      const membership=await repositories.memberships.get(tenantId,userId);if(!membership||membership.status!=='ACTIVE'||membership.platformRole!=='none')throw new CommercialAccessError(403,'Only an active laboratory member of this tenant may receive a seat.');
      const seatPool=await repositories.commercial.getSeatPool(tenantId,key,true);if(!seatPool)throw new CommercialAccessError(409,'Module seat pool is not configured.');if(await repositories.commercial.activeAssignment(tenantId,key,userId,true))throw new CommercialAccessError(409,'User already has this module seat.');if(seatPool.availableSeatCount<=0)throw new CommercialAccessError(409,'No module seats are available.');
      const next=await repositories.commercial.assignSeat(tenantId,key,userId,actor.actorId);await repositories.audit.append({tenantId,actorId:actor.actorId,actorName:actor.actorName,action:'commercial.seat.assigned',entityType:'commercial-seat-assignment',entityId:next.id,occurredAt:new Date().toISOString(),metadata:{previousState:null,newState:next}});return next;
    });}
  async releaseSeat(actor:CommercialActor,tenantId:string,key:ModuleKey,userId:string){this.requirePlatform(actor);return this.repositories.transaction(async repositories=>{const previous=await repositories.commercial.activeAssignment(tenantId,key,userId,true);if(!previous)throw new CommercialAccessError(404,'Active module seat assignment was not found.');const next=await repositories.commercial.releaseSeat(tenantId,key,userId,actor.actorId);await repositories.audit.append({tenantId,actorId:actor.actorId,actorName:actor.actorName,action:'commercial.seat.released',entityType:'commercial-seat-assignment',entityId:previous.id,occurredAt:new Date().toISOString(),metadata:{previousState:previous,newState:next}});return next!;});}

  async checkAccess(identity:RequestIdentity,key:ModuleKey){
    if(identity.platformRole==='platform-admin')throw new CommercialAccessError(403,'Platform administrators do not have tenant module access.');
    if(!await this.repositories.tenants.getOperational(identity.tenantId))throw new CommercialAccessError(403,'Laboratory tenant is not operational.');
    const entitlementValue=await this.requireActiveEntitlement(identity.tenantId,key);
    const assignmentValue=await this.repositories.commercial.activeAssignment(identity.tenantId,key,identity.userId);
    if(!assignmentValue)throw new CommercialAccessError(403,`${key} seat assignment is required.`);
    return {module:key,tenantId:identity.tenantId,userId:identity.userId,entitlement:entitlementValue,seatAssignment:assignmentValue};
  }
}

/** Deterministic compatibility bridge for the already-certified legacy tenant.
 * It materializes finite seats for memberships present during bootstrap and
 * never supplies a general runtime fallback for commercial tenants. */
export async function bootstrapExistingTenantCommercialAccess(db:SqlExecutor,tenantId:string){
  const membershipResult=await db.query<{user_id:string}>('SELECT user_id FROM identity_memberships WHERE tenant_id=$1 AND membership_status=\'ACTIVE\' AND platform_role=\'none\' ORDER BY user_id',[tenantId]);
  const members=membershipResult.rows.map(row=>row.user_id);
  for(const key of ['NORTHSTAR_CORE','DESIGN_STUDIO'] as const){
    await db.query(`INSERT INTO tenant_module_entitlements(tenant_id,module_key,state,source,metadata) VALUES($1,$2,'ACTIVE','legacy-bootstrap',$3::jsonb) ON CONFLICT(tenant_id,module_key) DO NOTHING`,[tenantId,key,JSON.stringify({compatibility:'existing-active-membership-snapshot'})]);
    await db.query(`INSERT INTO tenant_module_seat_pools(tenant_id,module_key,purchased_seat_count,source) VALUES($1,$2,$3,'legacy-bootstrap') ON CONFLICT(tenant_id,module_key) DO UPDATE SET purchased_seat_count=CASE WHEN tenant_module_seat_pools.source IN ('legacy-migration','legacy-bootstrap') AND NOT EXISTS (SELECT 1 FROM tenant_module_seat_assignments a WHERE a.tenant_id=tenant_module_seat_pools.tenant_id AND a.module_key=tenant_module_seat_pools.module_key AND a.released_at IS NULL) THEN GREATEST(tenant_module_seat_pools.purchased_seat_count,EXCLUDED.purchased_seat_count) ELSE tenant_module_seat_pools.purchased_seat_count END,source=CASE WHEN tenant_module_seat_pools.source='legacy-migration' THEN 'legacy-bootstrap' ELSE tenant_module_seat_pools.source END,updated_at=now()`,[tenantId,key,members.length]);
    for(const userId of members)await db.query(`INSERT INTO tenant_module_seat_assignments(tenant_id,module_key,user_id,assigned_by,metadata) VALUES($1,$2,$3,'legacy-bootstrap',$4::jsonb) ON CONFLICT DO NOTHING`,[tenantId,key,userId,JSON.stringify({compatibility:'existing-active-membership-snapshot'})]);
  }
  await db.query(`INSERT INTO tenant_module_entitlements(tenant_id,module_key,state,source,metadata) VALUES($1,'GVM','DISABLED','legacy-bootstrap',$2::jsonb) ON CONFLICT(tenant_id,module_key) DO NOTHING`,[tenantId,JSON.stringify({compatibility:'no-gvm-entitlement'})]);
  await db.query(`INSERT INTO tenant_module_seat_pools(tenant_id,module_key,purchased_seat_count,source) VALUES($1,'GVM',0,'legacy-bootstrap') ON CONFLICT(tenant_id,module_key) DO NOTHING`,[tenantId]);
}

/**
 * One-time post-identity reconciliation for the designated pre-commercial
 * tenant. The original 0009 migration snapshots memberships before the
 * durable runtime creates its historical administrator membership. This
 * materializes that finite missing NORTHSTAR_CORE seat once, records it in
 * the migration ledger, and never re-enables an explicitly managed module.
 */
export async function reconcileLegacyNorthstarCoreBootstrap(db:SqlExecutor,tenantId:string){
  if(tenantId!==LEGACY_NORTHSTAR_TENANT_ID)return false;
  const migrationKey='0009_legacy_northstar_core_post_identity_bootstrap';
    const applied=await db.query('SELECT 1 FROM tenant_migration_ledger WHERE migration_key=$1',[migrationKey]);
    if(applied.rowCount)return false;
    const members=await db.query<{user_id:string}>(`SELECT user_id FROM identity_memberships WHERE tenant_id=$1 AND membership_status='ACTIVE' AND platform_role='none' ORDER BY user_id`,[tenantId]);
    const seatCount=members.rows.length;
    await db.query(`INSERT INTO tenant_module_entitlements(tenant_id,module_key,state,source,metadata) VALUES($1,'NORTHSTAR_CORE','ACTIVE','legacy-core-post-identity-bootstrap',$2::jsonb) ON CONFLICT(tenant_id,module_key) DO NOTHING`,[tenantId,JSON.stringify({compatibility:'post-identity legacy snapshot',migration:migrationKey})]);
    await db.query(`INSERT INTO tenant_module_seat_pools(tenant_id,module_key,purchased_seat_count,source) VALUES($1,'NORTHSTAR_CORE',$2,'legacy-core-post-identity-bootstrap') ON CONFLICT(tenant_id,module_key) DO UPDATE SET purchased_seat_count=GREATEST(tenant_module_seat_pools.purchased_seat_count,EXCLUDED.purchased_seat_count),source=CASE WHEN tenant_module_seat_pools.source IN ('legacy-migration','legacy-bootstrap') THEN 'legacy-core-post-identity-bootstrap' ELSE tenant_module_seat_pools.source END,updated_at=now() WHERE tenant_module_seat_pools.source IN ('legacy-migration','legacy-bootstrap','legacy-core-post-identity-bootstrap')`,[tenantId,seatCount]);
    await db.query(`INSERT INTO tenant_module_seat_assignments(tenant_id,module_key,user_id,assigned_by,metadata) SELECT m.tenant_id,'NORTHSTAR_CORE',m.user_id,'legacy-core-post-identity-bootstrap',$2::jsonb FROM identity_memberships m JOIN tenant_module_seat_pools p ON p.tenant_id=m.tenant_id AND p.module_key='NORTHSTAR_CORE' AND p.source IN ('legacy-migration','legacy-bootstrap','legacy-core-post-identity-bootstrap') WHERE m.tenant_id=$1 AND m.membership_status='ACTIVE' AND m.platform_role='none' ON CONFLICT DO NOTHING`,[tenantId,JSON.stringify({compatibility:'post-identity legacy membership snapshot',migration:migrationKey})]);
    await db.query(`INSERT INTO tenant_migration_ledger(migration_key,legacy_tenant_id,ownership_rule,metadata) VALUES($1,$2,'A one-time post-identity snapshot assigns finite NORTHSTAR_CORE seats only to active non-platform memberships of the designated legacy tenant.',$3::jsonb)`,[migrationKey,tenantId,JSON.stringify({idempotent:true,entitlement:'ON CONFLICT DO NOTHING',seatPool:'legacy sources only',runtimeFallback:false})]);
    return true;
}

/**
 * The owner-preview database is created by applying migrations before the
 * historical durable runtime seeds its first legitimate owner. Migration 0009
 * therefore records the Design Studio entitlement but correctly sees zero
 * members and creates no Design Studio seats. This is deliberately narrower
 * than the legacy compatibility bridge: it is a one-time initial-owner
 * bootstrap for the designated legacy tenant only. It never
 * changes a commercial-control-plane decision, creates no platform access, and
 * is not a general tenant or runtime fallback.
 */
export async function reconcileLegacyDesignStudioInitialOwnerBootstrap(db:SqlExecutor,tenantId:string,userId:string){
  if(tenantId!==LEGACY_NORTHSTAR_TENANT_ID)return false;
  const migrationKey='preview_legacy_design_studio_initial_owner_bootstrap_v1';
  const applied=await db.query('SELECT 1 FROM tenant_migration_ledger WHERE migration_key=$1',[migrationKey]);
  if(applied.rowCount)return false;
  const member=await db.query<{user_id:string}>(`SELECT user_id FROM identity_memberships WHERE tenant_id=$1 AND user_id=$2 AND membership_status='ACTIVE' AND platform_role='none'`,[tenantId,userId]);
  if(!member.rowCount)return false;
  const existingEntitlement=await db.query<{source:string}>(`SELECT source FROM tenant_module_entitlements WHERE tenant_id=$1 AND module_key='DESIGN_STUDIO'`,[tenantId]);
  if(existingEntitlement.rows[0]?.source==='commercial-control-plane')return false;
  await db.query(`INSERT INTO tenant_module_entitlements(tenant_id,module_key,state,source,metadata) VALUES($1,'DESIGN_STUDIO','ACTIVE','preview-initial-owner-bootstrap',$2::jsonb) ON CONFLICT(tenant_id,module_key) DO NOTHING`,[tenantId,JSON.stringify({compatibility:'preview initial owner',migration:migrationKey})]);
  await db.query(`INSERT INTO tenant_module_seat_pools(tenant_id,module_key,purchased_seat_count,source) VALUES($1,'DESIGN_STUDIO',1,'preview-initial-owner-bootstrap') ON CONFLICT(tenant_id,module_key) DO UPDATE SET purchased_seat_count=GREATEST(tenant_module_seat_pools.purchased_seat_count,EXCLUDED.purchased_seat_count),source='preview-initial-owner-bootstrap',updated_at=now() WHERE tenant_module_seat_pools.source IN ('legacy-migration','preview-initial-owner-bootstrap')`,[tenantId]);
  await db.query(`INSERT INTO tenant_module_seat_assignments(tenant_id,module_key,user_id,assigned_by,metadata) SELECT $1,'DESIGN_STUDIO',$2,'preview-initial-owner-bootstrap',$3::jsonb WHERE EXISTS(SELECT 1 FROM tenant_module_seat_pools WHERE tenant_id=$1 AND module_key='DESIGN_STUDIO' AND source='preview-initial-owner-bootstrap') ON CONFLICT DO NOTHING`,[tenantId,userId,JSON.stringify({compatibility:'preview initial owner',migration:migrationKey})]);
  await db.query(`INSERT INTO tenant_migration_ledger(migration_key,legacy_tenant_id,ownership_rule,metadata) VALUES($1,$2,'A one-time owner-preview bootstrap assigns one existing active non-platform owner a Design Studio seat for the designated legacy tenant only. It never changes commercial-control-plane state or grants tenant access to platform administrators.',$3::jsonb)`,[migrationKey,tenantId,JSON.stringify({idempotent:true,scope:'legacy tenant initial owner only',runtimeFallback:false})]);
  return true;
}
