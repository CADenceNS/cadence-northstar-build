import assert from 'node:assert/strict';
import { createPostgresPool, PostgresRegistry } from './postgres.js';
import { DefaultPostgresRepositoryFactory } from './postgres-repositories.js';
import { PostgresObjectStorage } from './postgres-object-storage.js';
import type { Practice, User } from '@northstar/shared';

const connectionString=process.env.DATABASE_URL;
if(!connectionString)throw new Error('DATABASE_URL is required.');
const pool=createPostgresPool(connectionString);
const tenantA='00000000-0000-4000-8000-000000000001';
const tenantB='00000000-0000-4000-8000-000000000002';
const contextA={tenantId:tenantA,actorId:'integration',actorName:'Integration Test'};
const contextB={tenantId:tenantB,actorId:'integration',actorName:'Integration Test'};
const registry=new PostgresRegistry(pool,new DefaultPostgresRepositoryFactory());

try{
  await pool.query("INSERT INTO tenants(id,name) VALUES($1,'Tenant A'),($2,'Tenant B') ON CONFLICT DO NOTHING",[tenantA,tenantB]);
  const user:User={id:'user-integration',name:'Durable User',email:'durable@example.com',role:'administrator',active:true};
  await registry.users.save(contextA,user);
  assert.equal((await registry.users.findByEmail(contextA,'durable@example.com'))?.id,user.id);
  assert.equal(await registry.users.findByEmail(contextB,'durable@example.com'),null,'tenant isolation must prevent cross-tenant reads');

  const practice:Practice={id:'practice-integration',accountNumber:'KDL-9001',practiceName:'Durable Dental',status:'active',phone:'747.240.4008',email:'info@example.com',address:'19350 Business Ctr Dr',city:'Northridge',state:'CA',postalCode:'91324',taxExempt:false,scannerType:'3Shape',officeManager:{name:'Office Manager',email:'office@example.com',phone:'747.240.4008'},notes:'Persistence test',communicationHistory:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  await registry.practices.save(contextA,practice);
  assert.equal((await registry.practices.findByAccountNumber(contextA,'KDL-9001'))?.practiceName,'Durable Dental');
  await registry.practices.softDelete(contextA,practice.id,new Date().toISOString());
  assert.equal(await registry.practices.get(contextA,practice.id),null,'soft-deleted records must be hidden');
  assert.equal((await registry.practices.list(contextA,{includeDeleted:true})).length,1);

  await assert.rejects(registry.transaction(async tx=>{await tx.users.save(contextA,{...user,id:'rollback-user',email:'rollback@example.com'});throw new Error('rollback')}));
  assert.equal(await registry.users.findByEmail(contextA,'rollback@example.com'),null,'transaction rollback must remove writes');

  await registry.audit.append({tenantId:tenantA,actorId:'integration',actorName:'Integration Test',action:'practice.updated',entityType:'practice',entityId:practice.id,occurredAt:new Date().toISOString(),metadata:{source:'integration'}});
  assert.equal((await registry.audit.list(tenantA,'practice',practice.id)).length,1);
  await assert.rejects(pool.query("UPDATE audit_events SET action='changed' WHERE tenant_id=$1",[tenantA]),/immutable/);

  const storage=new PostgresObjectStorage(pool);
  const bytes=new TextEncoder().encode('durable-object');
  const stored=await storage.put({tenantId:tenantA,ownerType:'case',ownerId:'00000000-0000-4000-8000-000000000100',kind:'stl',fileName:'case.stl',mimeType:'model/stl',bytes});
  assert.deepEqual(await storage.get(stored.objectKey),bytes);
  await storage.delete(stored.objectKey);
  assert.equal(await storage.get(stored.objectKey),null);
  console.log('PostgreSQL repository integration contracts passed.');
}finally{await pool.end()}
