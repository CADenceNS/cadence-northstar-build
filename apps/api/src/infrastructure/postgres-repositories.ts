import type { ClinicalCase, Doctor, Invoice, MonthlyStatement, Patient, Practice, ProductionWorkItem, QCInspection, QCTemplate, Shipment, User } from '@northstar/shared';
import type { AuditRepository, CaseRepository, CommercialRepository, DoctorRepository, DurableFinancialRepository, EntityRepository, ListOptions, PatientRepository, PracticeRepository, ProductionRepository, QCRepository, RepositoryContext, ShippingRepository, TenantMembershipRepository, TenantRepository, UserRepository } from './contracts.js';
import { PostgresAuditRepository, type PostgresRepositoryFactory, type SqlExecutor } from './postgres.js';
import { PostgresTenantMembershipRepository, PostgresTenantRepository } from './tenant-native.js';
import { PostgresCommercialRepository } from './commercial-entitlements.js';

type Entity = { id:string };
type DocumentRow = { payload:unknown };

class PostgresDocumentRepository<T extends Entity> implements EntityRepository<T> {
  constructor(protected readonly db:SqlExecutor, private readonly entityType:string){}
  async list(context:RepositoryContext, options:ListOptions={}){
    const values:unknown[]=[context.tenantId,this.entityType,Math.min(options.limit??500,1000),Math.max(options.offset??0,0)];
    const deleted=options.includeDeleted?'':'AND deleted_at IS NULL';
    const result=await this.db.query<DocumentRow>(`SELECT payload FROM repository_documents WHERE tenant_id=$1 AND entity_type=$2 ${deleted} ORDER BY updated_at DESC LIMIT $3 OFFSET $4`,values);
    return result.rows.map(row=>row.payload as T);
  }
  async get(context:RepositoryContext,id:string){
    const result=await this.db.query<DocumentRow>('SELECT payload FROM repository_documents WHERE tenant_id=$1 AND entity_type=$2 AND entity_id=$3 AND deleted_at IS NULL',[context.tenantId,this.entityType,id]);
    return result.rows[0]?.payload as T|undefined??null;
  }
  async save(context:RepositoryContext,value:T){
    await this.db.query(`INSERT INTO repository_documents (tenant_id,entity_type,entity_id,payload) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (tenant_id,entity_type,entity_id) DO UPDATE SET payload=EXCLUDED.payload,version=repository_documents.version+1,updated_at=now(),deleted_at=NULL`,[context.tenantId,this.entityType,value.id,JSON.stringify(value)]);
  }
  async softDelete(context:RepositoryContext,id:string,deletedAt:string){
    await this.db.query('UPDATE repository_documents SET deleted_at=$4,updated_at=now(),version=version+1 WHERE tenant_id=$1 AND entity_type=$2 AND entity_id=$3',[context.tenantId,this.entityType,id,deletedAt]);
  }
  async findByPayload(context:RepositoryContext,path:string,value:string){
    const result=await this.db.query<DocumentRow>('SELECT payload FROM repository_documents WHERE tenant_id=$1 AND entity_type=$2 AND deleted_at IS NULL AND payload #>> string_to_array($3,\'.\')=$4 LIMIT 1',[context.tenantId,this.entityType,path,value]);
    return result.rows[0]?.payload as T|undefined??null;
  }
  async listByPayload(context:RepositoryContext,path:string,value:string){
    const result=await this.db.query<DocumentRow>('SELECT payload FROM repository_documents WHERE tenant_id=$1 AND entity_type=$2 AND deleted_at IS NULL AND payload #>> string_to_array($3,\'.\')=$4 ORDER BY updated_at DESC',[context.tenantId,this.entityType,path,value]);
    return result.rows.map(row=>row.payload as T);
  }
}

export class PostgresUserRepository extends PostgresDocumentRepository<User> implements UserRepository {
  constructor(db:SqlExecutor){super(db,'user')}
  findByEmail(context:RepositoryContext,email:string){return this.findByPayload(context,'email',email.toLowerCase())}
}
export class PostgresPracticeRepository extends PostgresDocumentRepository<Practice> implements PracticeRepository {
  constructor(db:SqlExecutor){super(db,'practice')}
  findByAccountNumber(context:RepositoryContext,accountNumber:string){return this.findByPayload(context,'accountNumber',accountNumber)}
}
export class PostgresDoctorRepository extends PostgresDocumentRepository<Doctor> implements DoctorRepository {
  constructor(db:SqlExecutor){super(db,'doctor')}
  listByPractice(context:RepositoryContext,practiceId:string){return this.listByPayload(context,'practiceId',practiceId)}
}
export class PostgresPatientRepository extends PostgresDocumentRepository<Patient> implements PatientRepository {
  constructor(db:SqlExecutor){super(db,'patient')}
  listByPractice(context:RepositoryContext,practiceId:string){return this.listByPayload(context,'practiceId',practiceId)}
}
export class PostgresCaseRepository extends PostgresDocumentRepository<ClinicalCase> implements CaseRepository {
  constructor(db:SqlExecutor){super(db,'case')}
  findByCaseNumber(context:RepositoryContext,caseNumber:string){return this.findByPayload(context,'caseNumber',caseNumber)}
}
export class PostgresProductionRepository extends PostgresDocumentRepository<ProductionWorkItem> implements ProductionRepository {
  constructor(db:SqlExecutor){super(db,'production')}
  listByDepartment(context:RepositoryContext,department:string){return this.listByPayload(context,'currentDepartment',department)}
}
export class PostgresShippingRepository extends PostgresDocumentRepository<Shipment> implements ShippingRepository {
  constructor(db:SqlExecutor){super(db,'shipment')}
  findByTrackingNumber(context:RepositoryContext,trackingNumber:string){return this.findByPayload(context,'trackingNumber',trackingNumber)}
}
export class PostgresQCRepository implements QCRepository {
  private readonly templates:PostgresDocumentRepository<QCTemplate>;
  private readonly inspections:PostgresDocumentRepository<QCInspection>;
  constructor(db:SqlExecutor){this.templates=new PostgresDocumentRepository(db,'qc-template');this.inspections=new PostgresDocumentRepository(db,'qc-inspection')}
  listTemplates(context:RepositoryContext){return this.templates.list(context)}
  saveTemplate(context:RepositoryContext,value:QCTemplate){return this.templates.save(context,value)}
  listInspections(context:RepositoryContext,caseId?:string){return caseId?this.inspections.listByPayload(context,'caseId',caseId):this.inspections.list(context)}
  saveInspection(context:RepositoryContext,value:QCInspection){return this.inspections.save(context,value)}
}
export class PostgresFinancialRepository implements DurableFinancialRepository {
  private readonly invoices:PostgresDocumentRepository<Invoice>;
  private readonly statements:PostgresDocumentRepository<MonthlyStatement>;
  constructor(db:SqlExecutor){this.invoices=new PostgresDocumentRepository(db,'invoice');this.statements=new PostgresDocumentRepository(db,'statement')}
  listInvoices(context:RepositoryContext){return this.invoices.list(context)}
  getInvoice(context:RepositoryContext,id:string){return this.invoices.get(context,id)}
  saveInvoice(context:RepositoryContext,value:Invoice){return this.invoices.save(context,value)}
  listStatements(context:RepositoryContext){return this.statements.list(context)}
  saveStatement(context:RepositoryContext,value:MonthlyStatement){return this.statements.save(context,value)}
}

export class DefaultPostgresRepositoryFactory implements PostgresRepositoryFactory {
  create(db:SqlExecutor){
    const audit:AuditRepository=new PostgresAuditRepository(db);
    return {
      tenants:new PostgresTenantRepository(db) satisfies TenantRepository,memberships:new PostgresTenantMembershipRepository(db) satisfies TenantMembershipRepository,commercial:new PostgresCommercialRepository(db) satisfies CommercialRepository,users:new PostgresUserRepository(db),practices:new PostgresPracticeRepository(db),doctors:new PostgresDoctorRepository(db),patients:new PostgresPatientRepository(db),cases:new PostgresCaseRepository(db),production:new PostgresProductionRepository(db),qc:new PostgresQCRepository(db),shipping:new PostgresShippingRepository(db),financial:new PostgresFinancialRepository(db),audit
    };
  }
}
