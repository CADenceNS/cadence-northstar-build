import type {
  ClinicalCase, Doctor, Invoice, MonthlyStatement, Patient, Practice,
  ProductionWorkItem, QCInspection, QCTemplate, Shipment, User
} from '@northstar/shared';

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
export interface AuditEventInput { tenantId:string; actorId:string; actorName:string; action:string; entityType:string; entityId:string; occurredAt:string; metadata:Record<string,unknown>; }
export interface AuditRepository { append(event:AuditEventInput):Promise<void>; list(tenantId:string,entityType?:string,entityId?:string):Promise<ReadonlyArray<AuditEventInput>>; }
export interface RepositoryRegistry { users:UserRepository; practices:PracticeRepository; doctors:DoctorRepository; patients:PatientRepository; cases:CaseRepository; production:ProductionRepository; qc:QCRepository; shipping:ShippingRepository; financial:DurableFinancialRepository; audit:AuditRepository; transaction<T>(work:(repositories:RepositoryRegistry)=>Promise<T>):Promise<T>; }
