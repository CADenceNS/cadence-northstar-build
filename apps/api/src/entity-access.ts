import type { Pool } from 'pg';
import type { RequestIdentity } from './security.js';

export type CommunicationEntityType='practice'|'doctor'|'patient'|'case'|'shipment'|'invoice';
export type EntityAccessMode='read'|'write';

type EntityScope={practiceIds:string[];doctorIds:string[];locationIds:string[]};
type MembershipRow={role:RequestIdentity['role'];location_ids:string[];practice_ids:string[];administrative_override:boolean};
type UserRow={id:string;name:string;email:string;active:boolean};

const writeRoles=new Set<RequestIdentity['role']>(['system-administrator','laboratory-administrator','office-manager','customer-service','cad-technician','production-technician','ceramist','qc-technician','shipping','billing','sales','doctor']);
const unique=(values:Array<string|null|undefined>)=>[...new Set(values.filter((value):value is string=>Boolean(value)))];

export class EntityAccessService{
 constructor(private readonly pool:Pool){}

 private async scope(tenantId:string,entityType:CommunicationEntityType,entityId:string):Promise<EntityScope|null>{
  if(entityType==='practice'){
   const result=await this.pool.query<{practice_id:string}>(`SELECT id::text practice_id FROM practices WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL`,[tenantId,entityId]);
   return result.rows[0]?{practiceIds:[result.rows[0].practice_id],doctorIds:[],locationIds:[]}:null;
  }
  if(entityType==='doctor'){
   const result=await this.pool.query<{practice_id:string;doctor_id:string}>(`SELECT practice_id::text,id::text doctor_id FROM doctors WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL`,[tenantId,entityId]);
   return result.rows[0]?{practiceIds:[result.rows[0].practice_id],doctorIds:[result.rows[0].doctor_id],locationIds:[]}:null;
  }
  if(entityType==='patient'){
   const result=await this.pool.query<{practice_id:string;doctor_id:string}>(`SELECT practice_id::text,doctor_id::text FROM patients WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL`,[tenantId,entityId]);
   return result.rows[0]?{practiceIds:[result.rows[0].practice_id],doctorIds:[result.rows[0].doctor_id],locationIds:[]}:null;
  }
  if(entityType==='case'){
   const result=await this.pool.query<{practice_id:string;doctor_id:string}>(`SELECT practice_id::text,doctor_id::text FROM clinical_cases WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL`,[tenantId,entityId]);
   return result.rows[0]?{practiceIds:[result.rows[0].practice_id],doctorIds:[result.rows[0].doctor_id],locationIds:[]}:null;
  }
  if(entityType==='shipment'){
   const result=await this.pool.query<{practice_id:string;doctor_id:string}>(`SELECT DISTINCT c.practice_id::text,c.doctor_id::text FROM shipments s JOIN shipment_cases sc ON sc.shipment_id=s.id JOIN clinical_cases c ON c.id=sc.case_id WHERE s.tenant_id=$1 AND s.id=$2 AND s.deleted_at IS NULL AND c.deleted_at IS NULL`,[tenantId,entityId]);
   return result.rowCount?{practiceIds:unique(result.rows.map(row=>row.practice_id)),doctorIds:unique(result.rows.map(row=>row.doctor_id)),locationIds:[]}:null;
  }
  const result=await this.pool.query<{practice_id:string}>(`SELECT practice_id::text FROM invoices WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL`,[tenantId,entityId]);
  return result.rows[0]?{practiceIds:[result.rows[0].practice_id],doctorIds:[],locationIds:[]}:null;
 }

 private async ownedDoctorIds(identity:RequestIdentity){
  if(identity.role!=='doctor')return[];
  const result=await this.pool.query<{id:string}>(`SELECT id::text FROM doctors WHERE tenant_id=$1 AND lower(email)=lower($2) AND status='active' AND deleted_at IS NULL`,[identity.tenantId,identity.email]);
  return result.rows.map(row=>row.id);
 }

 async canAccess(identity:RequestIdentity,entityType:CommunicationEntityType,entityId:string,mode:EntityAccessMode){
  if(mode==='write'&&!writeRoles.has(identity.role))return false;
  const scope=await this.scope(identity.tenantId,entityType,entityId);
  if(!scope)return false;
  if(identity.administrativeOverride)return true;
  if(scope.locationIds.length&&identity.locationIds.length&&!scope.locationIds.every(id=>identity.locationIds.includes(id)))return false;
  if(identity.practiceIds.length&&!scope.practiceIds.every(id=>identity.practiceIds.includes(id)))return false;
  if(identity.role==='doctor'){
   const owned=await this.ownedDoctorIds(identity);
   if(!owned.length)return false;
   if(scope.doctorIds.length)return scope.doctorIds.every(id=>owned.includes(id));
   const practices=await this.pool.query<{practice_id:string}>(`SELECT DISTINCT practice_id::text FROM doctors WHERE tenant_id=$1 AND id=ANY($2::uuid[])`,[identity.tenantId,owned]);
   const ownedPractices=practices.rows.map(row=>row.practice_id);
   return scope.practiceIds.every(id=>ownedPractices.includes(id));
  }
  return true;
 }

 async require(identity:RequestIdentity,entityType:CommunicationEntityType,entityId:string,mode:EntityAccessMode){
  if(!await this.canAccess(identity,entityType,entityId,mode)){const error=new Error('Entity access denied.');Object.assign(error,{statusCode:403});throw error}
 }

 async requireObject(identity:RequestIdentity,objectId:string,mode:EntityAccessMode){
  const result=await this.pool.query<{owner_type:string;owner_id:string}>(`SELECT owner_type,owner_id::text FROM object_records WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`,[objectId,identity.tenantId]);
  const object=result.rows[0];if(!object){const error=new Error('Attachment object was not found.');Object.assign(error,{statusCode:404});throw error}
  const mapped:Record<string,CommunicationEntityType|undefined>={practice:'practice',doctor:'doctor',patient:'patient',case:'case','clinical-case':'case',shipment:'shipment',invoice:'invoice'};
  const entityType=mapped[object.owner_type];
  if(entityType){await this.require(identity,entityType,object.owner_id,mode);return}
  if(object.owner_type==='communication-event'){
   const event=await this.pool.query<{entity_type:CommunicationEntityType;entity_id:string}>(`SELECT entity_type,entity_id FROM communication_events WHERE tenant_id=$1 AND id=$2`,[identity.tenantId,object.owner_id]);
   const row=event.rows[0];if(row){await this.require(identity,row.entity_type,row.entity_id,mode);return}
  }
  if(!identity.administrativeOverride){const error=new Error('Attachment association is not authorized.');Object.assign(error,{statusCode:403});throw error}
 }

 async recipient(identity:RequestIdentity,userId:string,entityType:CommunicationEntityType,entityId:string){
  const userResult=await this.pool.query<UserRow>(`SELECT id::text,name,email,active FROM users WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL`,[identity.tenantId,userId]);
  const membershipResult=await this.pool.query<MembershipRow>(`SELECT role,location_ids,practice_ids,administrative_override FROM identity_memberships WHERE tenant_id=$1 AND user_id=$2`,[identity.tenantId,userId]);
  const user=userResult.rows[0],membership=membershipResult.rows[0];
  if(!user?.active||!membership){const error=new Error('Notification recipient is invalid.');Object.assign(error,{statusCode:400});throw error}
  const recipientIdentity:RequestIdentity={userId:user.id,name:user.name,email:user.email,role:membership.role,tenantId:identity.tenantId,locationIds:membership.location_ids??[],practiceIds:membership.practice_ids??[],administrativeOverride:membership.administrative_override,sessionId:'notification-evaluation',csrfToken:''};
  if(!await this.canAccess(recipientIdentity,entityType,entityId,'read')){const error=new Error('Notification recipient is not authorized for this entity.');Object.assign(error,{statusCode:403});throw error}
  return recipientIdentity;
 }
}
