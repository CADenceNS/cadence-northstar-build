import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import type { AuditEventInput, AuditRepository, RepositoryRegistry } from './contracts.js';

export interface SqlExecutor { query<T extends QueryResultRow=QueryResultRow>(text:string,values?:unknown[]):Promise<{rows:T[];rowCount:number|null}>; }
export interface PostgresRepositoryFactory { create(executor:SqlExecutor):Omit<RepositoryRegistry,'transaction'>; }

export class PostgresAuditRepository implements AuditRepository {
  constructor(private readonly db:SqlExecutor){}
  async append(event:AuditEventInput){await this.db.query('INSERT INTO audit_events (tenant_id,actor_id,actor_name,action,entity_type,entity_id,occurred_at,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',[event.tenantId,event.actorId,event.actorName,event.action,event.entityType,event.entityId,event.occurredAt,JSON.stringify(event.metadata)])}
  async list(tenantId:string,entityType?:string,entityId?:string){const conditions=['tenant_id=$1'];const values:unknown[]=[tenantId];if(entityType){values.push(entityType);conditions.push(`entity_type=$${values.length}`)}if(entityId){values.push(entityId);conditions.push(`entity_id=$${values.length}`)}const result=await this.db.query<{tenant_id:string;actor_id:string;actor_name:string;action:string;entity_type:string;entity_id:string;occurred_at:Date;metadata:Record<string,unknown>}>(`SELECT tenant_id,actor_id,actor_name,action,entity_type,entity_id,occurred_at,metadata FROM audit_events WHERE ${conditions.join(' AND ')} ORDER BY occurred_at DESC`,values);return result.rows.map(row=>Object.freeze({tenantId:row.tenant_id,actorId:row.actor_id,actorName:row.actor_name,action:row.action,entityType:row.entity_type,entityId:row.entity_id,occurredAt:row.occurred_at.toISOString(),metadata:Object.freeze({...row.metadata})}))}
}

export class PostgresRegistry implements RepositoryRegistry {
  readonly users;readonly practices;readonly doctors;readonly patients;readonly cases;readonly production;readonly qc;readonly shipping;readonly financial;readonly audit;
  constructor(private readonly pool:Pool,private readonly factory:PostgresRepositoryFactory,executor:SqlExecutor=pool){const repositories=factory.create(executor);this.users=repositories.users;this.practices=repositories.practices;this.doctors=repositories.doctors;this.patients=repositories.patients;this.cases=repositories.cases;this.production=repositories.production;this.qc=repositories.qc;this.shipping=repositories.shipping;this.financial=repositories.financial;this.audit=repositories.audit}
  async transaction<T>(work:(repositories:RepositoryRegistry)=>Promise<T>){const client=await this.pool.connect();try{await client.query('BEGIN');const registry=new PostgresRegistry(this.pool,this.factory,clientAdapter(client));const result=await work(registry);await client.query('COMMIT');return result}catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}}
}
function clientAdapter(client:PoolClient):SqlExecutor{return{query:async<T extends QueryResultRow>(text:string,values?:unknown[])=>{const result=await client.query<T>(text,values);return{rows:result.rows,rowCount:result.rowCount}}}}
export function createPostgresPool(connectionString:string){return new Pool({connectionString,max:Number(process.env.DB_POOL_MAX??20),idleTimeoutMillis:30000,connectionTimeoutMillis:5000,application_name:'cadence-northstar'})}
