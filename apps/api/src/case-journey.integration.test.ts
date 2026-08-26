import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { ClinicalCase } from '@northstar/shared';
import type { RepositoryContext } from './infrastructure/contracts.js';
import { journeyForCase, prepareCaseJourney, saveCaseJourney } from './case-journey.js';

const connectionString=process.env.DATABASE_URL;
if(!connectionString)throw new Error('DATABASE_URL is required.');
const pool=new Pool({connectionString});
const tenantId='00000000-0000-0000-0000-000000000013';
const otherTenantId='00000000-0000-0000-0000-000000000014';
const context:RepositoryContext={tenantId,actorId:'journey-admin',actorName:'Journey Administrator'};
const runId=randomUUID();
const rootId=`journey-root-${runId}`;
const remakeId=`journey-remake-${runId}`;
const continuationId=`journey-continuation-${runId}`;
const otherId=`journey-other-${runId}`;
const patientId=`journey-patient-${runId}`;

const makeCase=(id:string,patient=patientId):ClinicalCase=>({id,caseNumber:id.toUpperCase(),patientId:patient,practiceId:'journey-practice',doctorId:'journey-doctor',status:'received',toothNumbers:[8],arch:'maxillary',restoration:'Full Zirconia Crown',material:'Zirconia',shade:'A2',stumpShade:'',rushPriority:'standard',receivedDate:'2026-08-25',dueDate:'2026-09-08',prescriptionNotes:'Journey test',attachments:[],createdAt:'2026-08-25T00:00:00.000Z',updatedAt:'2026-08-25T00:00:00.000Z'});
async function document(tenant:string,item:ClinicalCase){await pool.query(`INSERT INTO repository_documents(tenant_id,entity_type,entity_id,payload,created_at,updated_at) VALUES($1,'case',$2,$3::jsonb,now(),now())`,[tenant,item.id,JSON.stringify(item)]);}

try{
  await pool.query(`INSERT INTO tenants(id,name) VALUES($1,'Case Journey Tenant'),($2,'Other Journey Tenant') ON CONFLICT(id) DO NOTHING`,[tenantId,otherTenantId]);
  await pool.query("INSERT INTO tenant_case_journey_reasons(tenant_id,code,category,label) VALUES($1,'TEST_REMAKE','LAB_FABRICATION','Test remake reason') ON CONFLICT(tenant_id,code) DO UPDATE SET active=true",[tenantId]);
  await pool.query("INSERT INTO tenant_continuation_stages(tenant_id,code,label) VALUES($1,'TEST_STAGE','Test continuation stage') ON CONFLICT(tenant_id,code) DO UPDATE SET active=true",[tenantId]);
  await pool.query("INSERT INTO tenant_continuation_billing_policies(tenant_id,policy_type,label,is_default) VALUES($1,'BILL_AT_FINAL_COMPLETION','Test default policy',true) ON CONFLICT DO NOTHING",[tenantId]);
  const root=makeCase(rootId);await document(tenantId,root);const rootJourney=await prepareCaseJourney(pool,context,root.id,root);await saveCaseJourney(pool,context,root,rootJourney);assert.equal(rootJourney.rootCaseId,rootId);assert.equal(rootJourney.parentCaseId,null);
  const other=makeCase(otherId);await document(otherTenantId,other);await saveCaseJourney(pool,{...context,tenantId:otherTenantId},other,await prepareCaseJourney(pool,{...context,tenantId:otherTenantId},other.id,other));
  await assert.rejects(prepareCaseJourney(pool,context,'cross-tenant',{...makeCase('cross-tenant'),caseRelationship:'REMAKE',parentCaseId:otherId}),/not available in this tenant/);
  await assert.rejects(prepareCaseJourney(pool,context,remakeId,{...makeCase(remakeId),caseRelationship:'REMAKE',parentCaseId:rootId}),/reason/);
  const reason=(await pool.query<{id:string}>('SELECT id FROM tenant_case_journey_reasons WHERE tenant_id=$1 AND active=true ORDER BY code LIMIT 1',[tenantId])).rows[0];assert.ok(reason);
  const remake=makeCase(remakeId);await document(tenantId,remake);const remakeJourney=await prepareCaseJourney(pool,context,remakeId,{...remake,caseRelationship:'REMAKE',parentCaseId:rootId,remakeRepairReasonId:reason.id,responsibility:{responsibilityCategory:'SHARED',clinicPercentage:'50.00',labPercentage:'50.00',notes:'Confirmed after review',evidenceReferences:['evidence-1']}});await saveCaseJourney(pool,context,remake,remakeJourney);assert.equal(remakeJourney.rootCaseId,rootId);assert.equal(remakeJourney.parentCaseId,rootId);assert.equal(remakeJourney.responsibility?.confirmedBy,'Journey Administrator');
  await assert.rejects(prepareCaseJourney(pool,context,'bad-share',{...makeCase('bad-share'),caseRelationship:'REPAIR',parentCaseId:rootId,remakeRepairReasonId:reason.id,responsibility:{responsibilityCategory:'SHARED',clinicPercentage:'50',labPercentage:'49.99',notes:'',evidenceReferences:[]}}),/exactly 100/);
  await assert.rejects(prepareCaseJourney(pool,context,'wrong-patient',{...makeCase('wrong-patient','another-patient'),caseRelationship:'REPAIR',parentCaseId:rootId,remakeRepairReasonId:reason.id,responsibility:{responsibilityCategory:'LABORATORY',clinicPercentage:'0',labPercentage:'100',notes:'',evidenceReferences:[]}}),/selected patient/);
  const stage=(await pool.query<{id:string}>('SELECT id FROM tenant_continuation_stages WHERE tenant_id=$1 AND active=true ORDER BY code LIMIT 1',[tenantId])).rows[0];const policy=(await pool.query<{id:string}>('SELECT id FROM tenant_continuation_billing_policies WHERE tenant_id=$1 AND active=true AND is_default=true',[tenantId])).rows[0];assert.ok(stage&&policy);
  await assert.rejects(prepareCaseJourney(pool,context,'continuation-missing-stage',{...makeCase('continuation-missing-stage'),caseRelationship:'CONTINUATION',parentCaseId:remakeId,continuationOperationalState:'AWAITING_RETURN'}),/continuation stage/);
  await assert.rejects(prepareCaseJourney(pool,context,'continuation-missing-state',{...makeCase('continuation-missing-state'),caseRelationship:'CONTINUATION',parentCaseId:remakeId,continuationStageId:stage.id}),/operational state/);
  const nonDefaultPolicy=(await pool.query<{id:string}>('SELECT id FROM tenant_continuation_billing_policies WHERE tenant_id=$1 AND active=true AND is_default=false ORDER BY policy_type LIMIT 1',[tenantId])).rows[0];assert.ok(nonDefaultPolicy);
  const continuation=makeCase(continuationId);await document(tenantId,continuation);const continuationJourney=await prepareCaseJourney(pool,context,continuationId,{...continuation,caseRelationship:'CONTINUATION',parentCaseId:remakeId,continuationStageId:stage.id,continuationOperationalState:'AWAITING_RETURN',continuationBillingPolicyId:nonDefaultPolicy.id});assert.equal(continuationJourney.continuationBillingPolicyId,policy.id);await saveCaseJourney(pool,context,continuation,continuationJourney);const stored=await journeyForCase(pool,context,continuationId);assert.equal(stored?.rootCaseId,rootId);assert.equal(stored?.continuationOperationalState,'AWAITING_RETURN');
  const unconfiguredTenantId='00000000-0000-0000-0000-000000000015',unconfiguredContext={...context,tenantId:unconfiguredTenantId},unconfiguredRootId=`journey-unconfigured-root-${runId}`;await pool.query("INSERT INTO tenants(id,name) VALUES($1,'Unconfigured Journey Tenant') ON CONFLICT(id) DO NOTHING",[unconfiguredTenantId]);await pool.query("INSERT INTO tenant_continuation_stages(tenant_id,code,label) VALUES($1,'UNCONFIGURED_STAGE','Unconfigured test stage') ON CONFLICT(tenant_id,code) DO UPDATE SET active=true",[unconfiguredTenantId]);await pool.query("INSERT INTO tenant_continuation_billing_policies(tenant_id,policy_type,label,active,is_default) VALUES($1,'BILL_AT_FINAL_COMPLETION','Inactive default policy',false,true) ON CONFLICT(tenant_id,policy_type) DO UPDATE SET active=false,is_default=true",[unconfiguredTenantId]);const unconfiguredRoot=makeCase(unconfiguredRootId);await document(unconfiguredTenantId,unconfiguredRoot);await saveCaseJourney(pool,unconfiguredContext,unconfiguredRoot,await prepareCaseJourney(pool,unconfiguredContext,unconfiguredRootId,unconfiguredRoot));const unconfiguredStage=(await pool.query<{id:string}>('SELECT id FROM tenant_continuation_stages WHERE tenant_id=$1 AND code=$2',[unconfiguredTenantId,'UNCONFIGURED_STAGE'])).rows[0];assert.ok(unconfiguredStage);await assert.rejects(prepareCaseJourney(pool,unconfiguredContext,`journey-unconfigured-child-${runId}`,{...makeCase(`journey-unconfigured-child-${runId}`),caseRelationship:'CONTINUATION',parentCaseId:unconfiguredRootId,continuationStageId:unconfiguredStage.id,continuationOperationalState:'AWAITING_RETURN'}),/not configured/);
  await assert.rejects(pool.query("UPDATE case_journey_cases SET parent_case_id=$1 WHERE tenant_id=$2 AND case_id=$3",[rootId,tenantId,continuationId]),/immutable/);
  await assert.rejects(pool.query("UPDATE case_journey_responsibilities SET notes='changed' WHERE tenant_id=$1 AND case_id=$2",[tenantId,remakeId]),/immutable/);
  const lineage=await pool.query('SELECT case_id FROM case_journey_cases WHERE tenant_id=$1 AND root_case_id=$2 ORDER BY created_at',[tenantId,rootId]);assert.equal(lineage.rowCount,3);console.log('PP-1B case journey integration tests passed.');
} finally {await pool.end();}
