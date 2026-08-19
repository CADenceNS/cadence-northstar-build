import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { ClinicalCase, Doctor, Invoice, Patient, Practice } from '@northstar/shared';
import { PostgresObjectStorage } from './infrastructure/postgres-object-storage.js';
import { createPostgresPool, PostgresRegistry } from './infrastructure/postgres.js';
import { DefaultPostgresRepositoryFactory } from './infrastructure/postgres-repositories.js';

const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error('DATABASE_URL is required.');
const pool=createPostgresPool(databaseUrl),registry=new PostgresRegistry(pool,new DefaultPostgresRepositoryFactory());
const tenantA=randomUUID(),tenantB=randomUUID();
const contextA={tenantId:tenantA,actorId:'lab-a-owner',actorName:'Lab A Owner'};
const contextB={tenantId:tenantB,actorId:'lab-b-owner',actorName:'Lab B Owner'};
const now=new Date().toISOString();
const practice=(id:string):Practice=>({id,accountNumber:'SAME-100',practiceName:'Same Name Dental',status:'active',phone:'555-0100',email:'office@example.test',address:'1 Main',city:'Northridge',state:'CA',postalCode:'91324',taxExempt:false,scannerType:'',officeManager:{name:'Office Manager',email:'manager@example.test',phone:'555-0100'},notes:'',communicationHistory:[],createdAt:now,updatedAt:now});
const doctor=(id:string,practiceId:string):Doctor=>({id,practiceId,firstName:'Same',lastName:'Doctor',specialty:'General Dentistry',email:'doctor@example.test',phone:'555-0101',status:'active',notes:'',communicationHistory:[],createdAt:now,updatedAt:now});
const patient=(id:string,practiceId:string,doctorId:string):Patient=>({id,practiceId,doctorId,patientReference:'SAME-PATIENT',firstName:'Same',lastName:'Patient',dateOfBirth:'1984-06-12',status:'active',notes:'',createdAt:now,updatedAt:now});
const clinicalCase=(id:string,practiceId:string,doctorId:string,patientId:string):ClinicalCase=>({id,caseNumber:'SAME-CASE-001',practiceId,doctorId,patientId,status:'received',toothNumbers:[30],arch:'mandibular',restoration:'Full Zirconia Crown',material:'Zirconia',shade:'A2',stumpShade:'ND2',rushPriority:'standard',receivedDate:'2026-08-18',dueDate:'2026-09-01',prescriptionNotes:'',attachments:[],createdAt:now,updatedAt:now});
const invoice=(id:string,practiceId:string,caseId:string):Invoice=>({id,invoiceNumber:'SAME-INV-001',practiceId,practiceName:'Same Name Dental',shipmentIds:[],caseIds:[caseId],status:'open',terms:'net-30',issuedAt:now,dueAt:'2026-09-17T00:00:00.000Z',subtotal:100,discountTotal:0,adjustmentTotal:0,taxableAmount:100,taxRate:0,taxAmount:0,total:100,amountPaid:0,balance:100,lines:[],adjustments:[],payments:[],notes:'',createdAt:now,updatedAt:now});

try {
  await registry.tenants.create({id:tenantA,name:'Laboratory A',status:'ACTIVE',activationState:'ACTIVATED',commercialAccountReference:'acct-tenant-native-a',auditMetadata:{source:'tenant-native-test'}});
  await registry.tenants.create({id:tenantB,name:'Laboratory B',status:'TRIAL',activationState:'ACTIVATED',commercialAccountReference:'acct-tenant-native-b',auditMetadata:{source:'tenant-native-test'}});
  assert.equal((await registry.tenants.getOperational(tenantA))?.name,'Laboratory A');
  assert.equal((await registry.tenants.getOperational(tenantB))?.name,'Laboratory B');
  await registry.memberships.save({tenantId:tenantA,userId:'lab-a-owner',laboratoryRole:'laboratory-administrator',platformRole:'none',status:'ACTIVE',locationIds:[],practiceIds:[],administrativeOverride:true});
  await registry.memberships.save({tenantId:tenantB,userId:'lab-b-owner',laboratoryRole:'laboratory-administrator',platformRole:'none',status:'ACTIVE',locationIds:[],practiceIds:[],administrativeOverride:true});
  await registry.memberships.save({tenantId:tenantA,userId:'platform-admin',laboratoryRole:'system-administrator',platformRole:'platform-admin',status:'ACTIVE',locationIds:[],practiceIds:[],administrativeOverride:true});
  assert.equal((await registry.memberships.get(tenantA,'lab-a-owner'))?.platformRole,'none');
  assert.equal((await registry.memberships.get(tenantA,'platform-admin'))?.platformRole,'platform-admin');

  const practiceA=practice(randomUUID()),practiceB=practice(randomUUID());
  await registry.practices.save(contextA,practiceA);await registry.practices.save(contextB,practiceB);
  const doctorA=doctor(randomUUID(),practiceA.id),doctorB=doctor(randomUUID(),practiceB.id);
  await registry.doctors.save(contextA,doctorA);await registry.doctors.save(contextB,doctorB);
  const patientA=patient(randomUUID(),practiceA.id,doctorA.id),patientB=patient(randomUUID(),practiceB.id,doctorB.id);
  await registry.patients.save(contextA,patientA);await registry.patients.save(contextB,patientB);
  const caseA=clinicalCase(randomUUID(),practiceA.id,doctorA.id,patientA.id),caseB=clinicalCase(randomUUID(),practiceB.id,doctorB.id,patientB.id);
  await registry.cases.save(contextA,caseA);await registry.cases.save(contextB,caseB);
  await registry.financial.saveInvoice(contextA,invoice(randomUUID(),practiceA.id,caseA.id));
  await registry.financial.saveInvoice(contextB,invoice(randomUUID(),practiceB.id,caseB.id));

  assert.equal(await registry.patients.get(contextA,patientB.id),null,'Lab A exact-ID read must not disclose Lab B patient');
  assert.equal(await registry.patients.get(contextB,patientA.id),null,'Lab B exact-ID read must not disclose Lab A patient');
  assert.equal((await registry.patients.list(contextA)).some(value=>value.id===patientB.id),false,'Lab A lists must exclude Lab B patients');
  assert.equal((await registry.cases.list(contextB)).some(value=>value.id===caseA.id),false,'Lab B lists must exclude Lab A cases');
  assert.equal((await registry.financial.listInvoices(contextA)).length,1,'same invoice-like values remain independent per tenant');
  assert.equal((await registry.financial.listInvoices(contextB)).length,1,'same invoice-like values remain independent per tenant');
  await registry.patients.softDelete(contextB,patientA.id,now);
  assert.equal((await registry.patients.get(contextA,patientA.id))?.id,patientA.id,'cross-tenant delete attempt must not alter Lab A data');

  const storage=new PostgresObjectStorage(pool);const stored=await storage.put({tenantId:tenantA,ownerType:'case',ownerId:caseA.id,kind:'stl',fileName:'a.stl',mimeType:'model/stl',bytes:new TextEncoder().encode('tenant-a-artifact')});
  const foreignObject=await pool.query('SELECT id FROM object_records WHERE id=$1 AND tenant_id=$2',[stored.id,tenantB]);
  assert.equal(foreignObject.rowCount,0,'artifact metadata must remain tenant-scoped');

  await registry.tenants.updateLifecycle({id:tenantB,status:'SUSPENDED',activationState:'DEACTIVATED',commercialAccountReference:'acct-tenant-native-b',auditMetadata:{reason:'security-test'}});
  assert.equal(await registry.tenants.getOperational(tenantB),null,'suspended tenant must fail the operational-access policy');
  assert.equal((await registry.patients.get(contextB,patientB.id))?.id,patientB.id,'suspension must retain tenant data');
  await registry.tenants.updateLifecycle({id:tenantB,status:'ACTIVE',activationState:'ACTIVATED',commercialAccountReference:'acct-tenant-native-b',auditMetadata:{reactivated:true}});
  assert.equal((await registry.tenants.getOperational(tenantB))?.id,tenantB,'reactivated tenant regains only its own repository scope');
  await registry.tenants.updateLifecycle({id:tenantB,status:'CANCELLED',activationState:'DEACTIVATED',commercialAccountReference:'acct-tenant-native-b',auditMetadata:{cancelled:true}});
  assert.equal(await registry.tenants.getOperational(tenantB),null,'cancelled tenant must not receive operational access');
  assert.equal((await registry.cases.get(contextB,caseB.id))?.id,caseB.id,'cancellation must retain tenant operational records');

  const migration=await pool.query<{ownership_rule:string}>('SELECT ownership_rule FROM tenant_migration_ledger WHERE migration_key=$1',['0008_tenant_native_operations']);
  assert.match(migration.rows[0]?.ownership_rule??'',/designated legacy tenant/,'legacy migration ownership must be recorded exactly once');
  console.log('CF-1A1 tenant-native repository and migration security tests passed.');
} finally {
  await pool.end();
}
