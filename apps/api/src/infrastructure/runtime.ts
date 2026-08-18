import type { FinancialRepository, Invoice, MonthlyStatement } from '@northstar/shared';
import { DefaultPostgresRepositoryFactory } from './postgres-repositories.js';
import { PostgresObjectStorage } from './postgres-object-storage.js';
import { PostgresRegistry, createPostgresPool } from './postgres.js';
import type { AuditEventInput, RepositoryContext } from './contracts.js';
import { legacyTenantId } from './tenant-native.js';

export const defaultTenantId=process.env.NORTHSTAR_TENANT_ID??legacyTenantId;
export const systemContext:RepositoryContext={tenantId:defaultTenantId,actorId:'system',actorName:'CADence NorthStar'};

export async function createDurableRuntime(){
 const connectionString=process.env.DATABASE_URL;
 if(!connectionString)throw new Error('DATABASE_URL is required for the production runtime.');
 const pool=createPostgresPool(connectionString);
 await pool.query("INSERT INTO tenants(id,name,status,activation_state,commercial_account_reference,audit_metadata) VALUES ($1,'Keramos Dental Laboratory','ACTIVE','ACTIVATED','legacy-northstar-default','{}'::jsonb) ON CONFLICT (id) DO NOTHING",[defaultTenantId]);
 const repositories=new PostgresRegistry(pool,new DefaultPostgresRepositoryFactory());
 const objects=new PostgresObjectStorage(pool,'northstar-production');
 return {pool,repositories,objects,context:systemContext,audit:async(input:Omit<AuditEventInput,'tenantId'>)=>repositories.audit.append({tenantId:defaultTenantId,...input})};
}

export class LegacyFinancialRepositoryAdapter implements FinancialRepository {
 constructor(private readonly runtime:Awaited<ReturnType<typeof createDurableRuntime>>,private readonly context:RepositoryContext=runtime.context){}
 listInvoices(){return this.runtime.repositories.financial.listInvoices(this.context)}
 getInvoice(id:string){return this.runtime.repositories.financial.getInvoice(this.context,id)}
 saveInvoice(invoice:Invoice){return this.runtime.repositories.financial.saveInvoice(this.context,invoice)}
 listStatements(){return this.runtime.repositories.financial.listStatements(this.context)}
 saveStatement(statement:MonthlyStatement){return this.runtime.repositories.financial.saveStatement(this.context,statement)}
}
