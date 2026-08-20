import type {
  ClinicalCase, Doctor, Invoice, MonthlyStatement, Patient, Practice,
  ProductionWorkItem, QCInspection, QCTemplate, Shipment, User
} from '@northstar/shared';
import type { LaboratoryTenant, TenantMembership } from './tenant-native.js';
import type { ActivationCredential, ModuleEntitlement, ModuleKey, ModuleSeatAssignment, ModuleSeatPool } from './commercial-entitlements.js';

export interface RepositoryContext { tenantId:string; actorId:string; actorName:string; }
export interface ListOptions { includeDeleted?:boolean; limit?:number; offset?:number; }
export interface EntityRepository<T extends {id:string}> {
  list(context:RepositoryContext, options?:ListOptions):Promise<T[]>;
  get(context:RepositoryContext,id:string):Promise<T|null>;
  save(context:RepositoryContext,value:T):Promise<void>;
  softDelete(context:RepositoryContext,id:string,deletedAt:string):Promise<void>;
}
export interface UserRepository extends EntityRepository<User> { findByEmail(context:RepositoryContext,email:string):Promise<User|null>; }
export interface PracticeRepository extends EntityRepository<Practice> { findByAccountNumber(context:RepositoryContext,accountNumber:string):Promise<Practice|null>; }
export interface DoctorRepository extends EntityRepository<Doctor> { listByPractice(context:RepositoryContext,practiceId:string):Promise<Doctor[]>; }
export interface PatientRepository extends EntityRepository<Patient> { listByPractice(context:RepositoryContext,practiceId:string):Promise<Patient[]>; }
export interface CaseRepository extends EntityRepository<ClinicalCase> { findByCaseNumber(context:RepositoryContext,caseNumber:string):Promise<ClinicalCase|null>; }
export interface ProductionRepository extends EntityRepository<ProductionWorkItem> { listByDepartment(context:RepositoryContext,department:string):Promise<ProductionWorkItem[]>; }
export interface QCRepository { listTemplates(context:RepositoryContext):Promise<QCTemplate[]>; saveTemplate(context:RepositoryContext,value:QCTemplate):Promise<void>; listInspections(context:RepositoryContext,caseId?:string):Promise<QCInspection[]>; saveInspection(context:RepositoryContext,value:QCInspection):Promise<void>; }
export interface ShippingRepository extends EntityRepository<Shipment> { findByTrackingNumber(context:RepositoryContext,trackingNumber:string):Promise<Shipment|null>; }
export interface DurableFinancialRepository { listInvoices(context:RepositoryContext):Promise<Invoice[]>; getInvoice(context:RepositoryContext,id:string):Promise<Invoice|null>; saveInvoice(context:RepositoryContext,value:Invoice):Promise<void>; listStatements(context:RepositoryContext):Promise<MonthlyStatement[]>; saveStatement(context:RepositoryContext,value:MonthlyStatement):Promise<void>; }
export type TenantLifecycleUpdate=Pick<LaboratoryTenant,'id'|'status'|'activationState'|'commercialAccountReference'|'auditMetadata'>&Partial<Pick<LaboratoryTenant,'commercialActivatedAt'|'commercialSuspendedAt'|'commercialCancelledAt'>>;
export type TenantCreate=Omit<LaboratoryTenant,'createdAt'|'updatedAt'|'commercialActivatedAt'|'commercialSuspendedAt'|'commercialCancelledAt'>&Partial<Pick<LaboratoryTenant,'commercialActivatedAt'|'commercialSuspendedAt'|'commercialCancelledAt'>>;
export interface TenantRepository { list():Promise<LaboratoryTenant[]>; get(id:string):Promise<LaboratoryTenant|null>; getOperational(id:string):Promise<LaboratoryTenant|null>; create(value:TenantCreate):Promise<void>; updateLifecycle(value:TenantLifecycleUpdate):Promise<void>; }
export interface TenantMembershipRepository { get(tenantId:string,userId:string):Promise<TenantMembership|null>; save(value:TenantMembership):Promise<void>; }
export interface CommercialRepository {
  getEntitlement(tenantId:string,moduleKey:ModuleKey):Promise<ModuleEntitlement|null>;
  listEntitlements(tenantId:string):Promise<ModuleEntitlement[]>;
  setEntitlement(value:Pick<ModuleEntitlement,'tenantId'|'moduleKey'|'state'|'effectiveFrom'|'effectiveUntil'|'source'|'metadata'>):Promise<ModuleEntitlement|null>;
  getSeatPool(tenantId:string,moduleKey:ModuleKey,lock?:boolean):Promise<ModuleSeatPool|null>;
  listSeatPools(tenantId:string):Promise<ModuleSeatPool[]>;
  setSeatPool(tenantId:string,moduleKey:ModuleKey,purchasedSeatCount:number):Promise<ModuleSeatPool|null>;
  activeAssignment(tenantId:string,moduleKey:ModuleKey,userId:string,lock?:boolean):Promise<ModuleSeatAssignment|null>;
  assignSeat(tenantId:string,moduleKey:ModuleKey,userId:string,actorId:string,metadata?:Record<string,unknown>):Promise<ModuleSeatAssignment>;
  releaseSeat(tenantId:string,moduleKey:ModuleKey,userId:string,actorId:string):Promise<ModuleSeatAssignment|null>;
  getActivationCredential(id:string):Promise<ActivationCredential|null>;
  listActivationCredentials(tenantId:string):Promise<ActivationCredential[]>;
  createActivationCredential(value:Pick<ActivationCredential,'id'|'tenantId'|'secretHash'|'issuedBy'|'expiresAt'|'supersedesCredentialId'|'metadata'>):Promise<ActivationCredential>;
  activateCredential(id:string,actorId:string):Promise<ActivationCredential|null>;
  revokeActivationCredential(id:string,actorId:string,reason:string|null,replacedByCredentialId?:string|null):Promise<ActivationCredential|null>;
}
export interface AuditEventInput { tenantId:string; actorId:string; actorName:string; action:string; entityType:string; entityId:string; occurredAt:string; metadata:Record<string,unknown>; }
export interface AuditRepository { append(event:AuditEventInput):Promise<void>; list(tenantId:string,entityType?:string,entityId?:string):Promise<ReadonlyArray<AuditEventInput>>; }
export interface RepositoryRegistry { tenants:TenantRepository; memberships:TenantMembershipRepository; commercial:CommercialRepository; users:UserRepository; practices:PracticeRepository; doctors:DoctorRepository; patients:PatientRepository; cases:CaseRepository; production:ProductionRepository; qc:QCRepository; shipping:ShippingRepository; financial:DurableFinancialRepository; audit:AuditRepository; transaction<T>(work:(repositories:RepositoryRegistry)=>Promise<T>):Promise<T>; }
