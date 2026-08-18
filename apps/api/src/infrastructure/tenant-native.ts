import type { SqlExecutor } from './postgres.js';

export const legacyTenantId='00000000-0000-0000-0000-000000000001';
export type TenantStatus='TRIAL'|'ACTIVE'|'SUSPENDED'|'CANCELLED';
export type TenantActivationState='PENDING'|'ACTIVATED'|'DEACTIVATED';
export type MembershipStatus='ACTIVE'|'SUSPENDED'|'REVOKED';
export type PlatformRole='none'|'platform-admin';

export interface LaboratoryTenant {
  id:string;
  name:string;
  status:TenantStatus;
  activationState:TenantActivationState;
  commercialAccountReference:string|null;
  auditMetadata:Record<string,unknown>;
  createdAt:string;
  updatedAt:string;
}

export interface TenantMembership {
  tenantId:string;
  userId:string;
  laboratoryRole:string;
  platformRole:PlatformRole;
  status:MembershipStatus;
  locationIds:ReadonlyArray<string>;
  practiceIds:ReadonlyArray<string>;
  administrativeOverride:boolean;
}

type TenantRow={id:string;name:string;status:TenantStatus;activation_state:TenantActivationState;commercial_account_reference:string|null;audit_metadata:Record<string,unknown>;created_at:Date;updated_at:Date};
type MembershipRow={tenant_id:string;user_id:string;role:string;platform_role:PlatformRole;membership_status:MembershipStatus;location_ids:string[];practice_ids:string[];administrative_override:boolean};

const tenant=(row:TenantRow):LaboratoryTenant=>Object.freeze({id:row.id,name:row.name,status:row.status,activationState:row.activation_state,commercialAccountReference:row.commercial_account_reference,auditMetadata:Object.freeze({...row.audit_metadata}),createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString()});
const membership=(row:MembershipRow):TenantMembership=>Object.freeze({tenantId:row.tenant_id,userId:row.user_id,laboratoryRole:row.role,platformRole:row.platform_role,status:row.membership_status,locationIds:Object.freeze([...(row.location_ids??[])]),practiceIds:Object.freeze([...(row.practice_ids??[])]),administrativeOverride:row.administrative_override});

export function tenantHasOperationalAccess(value:{status:TenantStatus;activationState:TenantActivationState}){
  return (value.status==='TRIAL'||value.status==='ACTIVE')&&value.activationState==='ACTIVATED';
}

export class PostgresTenantRepository {
  constructor(private readonly db:SqlExecutor){}

  async get(id:string){
    const result=await this.db.query<TenantRow>('SELECT id::text,name,status,activation_state,commercial_account_reference,audit_metadata,created_at,updated_at FROM tenants WHERE id=$1 AND deleted_at IS NULL',[id]);
    return result.rows[0]?tenant(result.rows[0]):null;
  }

  async getOperational(id:string){
    const result=await this.db.query<TenantRow>("SELECT id::text,name,status,activation_state,commercial_account_reference,audit_metadata,created_at,updated_at FROM tenants WHERE id=$1 AND deleted_at IS NULL AND status IN ('TRIAL','ACTIVE') AND activation_state='ACTIVATED'",[id]);
    return result.rows[0]?tenant(result.rows[0]):null;
  }

  async create(value:Omit<LaboratoryTenant,'createdAt'|'updatedAt'>){
    await this.db.query('INSERT INTO tenants(id,name,status,activation_state,commercial_account_reference,audit_metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[value.id,value.name,value.status,value.activationState,value.commercialAccountReference,JSON.stringify(value.auditMetadata)]);
  }

  async updateLifecycle(value:Pick<LaboratoryTenant,'id'|'status'|'activationState'|'commercialAccountReference'|'auditMetadata'>){
    await this.db.query('UPDATE tenants SET status=$2,activation_state=$3,commercial_account_reference=$4,audit_metadata=$5::jsonb,updated_at=now() WHERE id=$1 AND deleted_at IS NULL',[value.id,value.status,value.activationState,value.commercialAccountReference,JSON.stringify(value.auditMetadata)]);
  }
}

export class PostgresTenantMembershipRepository {
  constructor(private readonly db:SqlExecutor){}

  async get(tenantId:string,userId:string){
    const result=await this.db.query<MembershipRow>('SELECT tenant_id::text,user_id,role,platform_role,membership_status,location_ids,practice_ids,administrative_override FROM identity_memberships WHERE tenant_id=$1 AND user_id=$2',[tenantId,userId]);
    return result.rows[0]?membership(result.rows[0]):null;
  }

  async save(value:TenantMembership){
    await this.db.query(`INSERT INTO identity_memberships(tenant_id,user_id,role,platform_role,membership_status,location_ids,practice_ids,administrative_override)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(tenant_id,user_id) DO UPDATE SET role=EXCLUDED.role,platform_role=EXCLUDED.platform_role,membership_status=EXCLUDED.membership_status,location_ids=EXCLUDED.location_ids,practice_ids=EXCLUDED.practice_ids,administrative_override=EXCLUDED.administrative_override,updated_at=now()`,[value.tenantId,value.userId,value.laboratoryRole,value.platformRole,value.status,value.locationIds,value.practiceIds,value.administrativeOverride]);
  }
}
