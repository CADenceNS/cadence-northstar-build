import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, type PoolClient } from 'pg';

export interface MigrationDefinition { version:string; filename:string; }
export interface MigrationRunResult { applied:string[]; adopted:string[]; skipped:string[]; }
export interface MigrationRunOptions { connectionString:string; migrationDirectory?:string; migrations?:MigrationDefinition[]; schema?:string; }

const defaultMigrationDirectory=resolve(dirname(fileURLToPath(import.meta.url)),'../migrations');
export const migrations:MigrationDefinition[]=[
  ['0001','0001_infrastructure_core.sql'],['0002','0002_repository_documents.sql'],['0003','0003_identity_security.sql'],['0004','0004_clinical_communications.sql'],['0005','0005_digital_intake_platform.sql'],['0006','0006_intake_administration.sql'],['0007','0007_uat_foundation.sql'],['0008','0008_tenant_native_operations.sql'],['0009','0009_commercial_entitlements.sql'],['0010','0010_commercial_activation_licensing.sql'],['0011','0011_product_pricing_case_line_items.sql'],['0012','0012_patient_reference_optional.sql'],['0013','0013_case_journey_foundation.sql'],['0014','0014_case_builder_product_line_authority.sql'],['0015','0015_case_builder_structured_configuration.sql'],['0016','0016_operational_case_intake_foundation.sql'],['0017','0017_universal_intake_case_linkage.sql'],['0018','0018_case_intake_submission_link_cascade.sql']
].map(([version,filename])=>({version,filename}));

export async function loadMigrations(directory=defaultMigrationDirectory):Promise<MigrationDefinition[]>{
  const files=await readdir(directory);
  return files.flatMap(filename=>{
    const match=/^(\d+)_.*\.sql$/.exec(filename);
    return match&&!filename.endsWith('.rollback.sql')?[{version:match[1]!,filename}]:[];
  }).sort((left,right)=>left.version.localeCompare(right.version)||left.filename.localeCompare(right.filename));
}

type Requirement={tables?:string[];columns?:Array<[string,string]>;indexes?:string[];functions?:string[];triggers?:string[];constraints?:string[];templateCount?:number;templateCopiesForExistingTenants?:boolean;caseJourneyCopiesForExistingCases?:boolean};
const requirements:Record<string,Requirement>={
  '0001':{tables:['tenants','users','practices','doctors','patients','clinical_cases','production_work_items','qc_templates','qc_inspections','shipments','shipment_cases','invoices','invoice_shipments','invoice_lines','invoice_adjustments','payments','monthly_statements','object_records','audit_events'],indexes:['idx_doctors_practice','idx_patients_practice_doctor','idx_cases_status_due','idx_production_queue','idx_qc_case_outcome','idx_shipments_status','idx_invoices_practice_due','idx_audit_entity','idx_objects_owner'],functions:['prevent_audit_mutation'],triggers:['audit_events_no_update']},
  '0002':{tables:['repository_documents','object_payloads'],indexes:['idx_repository_documents_active','idx_repository_documents_payload']},
  '0003':{tables:['identity_credentials','identity_memberships','identity_sessions','identity_tokens'],indexes:['identity_sessions_user_active_idx','identity_sessions_expiry_idx','identity_tokens_user_idx']},
  '0004':{tables:['communication_threads','communication_events','communication_attachments','communication_notifications'],indexes:['idx_communication_threads_entity','idx_communication_events_entity','idx_communication_events_thread','idx_communication_events_actor','idx_communication_events_type','idx_communication_events_search','idx_communication_notifications_recipient'],triggers:['communication_events_immutable']},
  '0005':{tables:['scanner_providers','doctor_preference_profiles','product_catalog','intake_submissions','digital_prescriptions','intake_attachments','intake_validations','intake_routing_resolutions','intake_product_resolutions','intake_billing_reviews','intake_history'],indexes:['intake_submissions_queue_idx','intake_history_timeline_idx','intake_validations_submission_idx','intake_products_submission_idx'],functions:['prevent_intake_history_mutation'],triggers:['intake_history_immutable']},
  '0006':{tables:['practice_routing_profiles','tenant_routing_defaults','pricing_schedules','pricing_schedule_items'],indexes:['practice_routing_profiles_lookup_idx','pricing_schedules_resolution_idx']},
  '0007':{tables:['environment_metadata','feature_flags','uat_test_plans','uat_test_cases','uat_executions','uat_defects','uat_evidence_attachments','uat_seed_runs'],indexes:['uat_plan_status_idx','uat_case_plan_idx','uat_execution_case_idx','uat_defect_status_idx','uat_evidence_owner_idx','feature_flag_lookup_idx']},
  '0008':{tables:['tenant_migration_ledger'],columns:[['tenants','status'],['tenants','activation_state'],['tenants','commercial_account_reference'],['identity_memberships','membership_status'],['identity_memberships','platform_role'],['identity_sessions','platform_role']],indexes:['tenants_operational_access_idx','identity_memberships_operational_idx'],constraints:['tenants_status_check','tenants_activation_state_check','identity_memberships_status_check','identity_memberships_platform_role_check','identity_sessions_platform_role_check']},
  '0009':{tables:['tenant_module_entitlements','tenant_module_seat_pools','tenant_module_seat_assignments'],indexes:['tenant_module_active_seat_assignment_idx','tenant_module_seat_assignment_history_idx','tenant_module_entitlement_effective_idx']},
  '0010':{tables:['tenant_activation_credentials'],columns:[['tenants','commercial_activated_at'],['tenants','commercial_suspended_at'],['tenants','commercial_cancelled_at']],indexes:['tenants_commercial_account_reference_idx','tenant_activation_credentials_active_idx','tenant_activation_credentials_history_idx']},
  '0011':{tables:['product_catalog_templates','product_price_versions','product_compatibility_rules','tenant_business_closure_days','case_product_lines','case_product_line_lineage','case_product_tat_overrides'],columns:[['product_catalog','category_code'],['product_catalog','family_code'],['product_catalog','description'],['product_catalog','pricing_basis'],['product_catalog','default_turnaround_business_days'],['product_catalog','configuration_metadata'],['product_catalog','compatibility_metadata'],['product_catalog','archived_at']],indexes:['product_price_versions_lookup_idx','product_compatibility_active_idx','case_product_lines_case_idx','case_product_tat_overrides_one_active_idx'],functions:['enforce_product_price_version_period'],triggers:['product_price_versions_period_guard'],constraints:['product_catalog_category_code_check','product_catalog_pricing_basis_check','product_catalog_turnaround_check','product_catalog_tenant_id_unique','clinical_cases_tenant_id_unique'],templateCount:87,templateCopiesForExistingTenants:true},
  '0012':{indexes:['patients_tenant_practice_reference_nonblank_unique']},
  '0013':{tables:['case_journey_cases','tenant_case_journey_reasons','tenant_continuation_stages','tenant_continuation_billing_policies','case_journey_responsibilities'],columns:[['case_journey_cases','case_relationship'],['case_journey_cases','root_case_id'],['case_journey_cases','parent_case_id'],['case_journey_cases','patient_id'],['case_journey_cases','continuation_operational_state'],['case_journey_responsibilities','clinic_percentage'],['case_journey_responsibilities','lab_percentage']],indexes:['case_journey_root_idx','case_journey_parent_idx','case_journey_reason_active_idx','continuation_stage_active_idx','tenant_continuation_policy_one_default_idx'],functions:['prevent_case_journey_cycle','prevent_case_journey_responsibility_mutation'],triggers:['case_journey_cycle_guard','case_journey_responsibility_guard'],constraints:['case_journey_reason_tenant_fk','case_journey_stage_tenant_fk','case_journey_policy_tenant_fk'],caseJourneyCopiesForExistingCases:true},
  '0014':{tables:['case_product_line_case_entities'],columns:[['case_product_lines','case_entity_type'],['case_product_lines','family_code_snapshot'],['case_product_tat_overrides','case_entity_type']],indexes:['case_product_lines_case_document_idx'],functions:['sync_case_product_line_case_entity'],triggers:['repository_documents_case_product_line_entity'],constraints:['case_product_lines_case_document_tenant_fk','case_product_tat_overrides_case_document_tenant_fk']},
  '0015':{tables:['tenant_restoration_subtypes','product_restoration_subtype_mappings','tenant_option_sets','tenant_option_values','product_configuration_requirements'],indexes:['product_restoration_subtype_lookup_idx','tenant_option_values_lookup_idx','product_configuration_requirements_lookup_idx'],functions:['sync_product_restoration_subtype_mapping'],triggers:['product_catalog_subtype_mapping']},
  '0016':{tables:['case_intake_profiles','tenant_case_hold_reasons','tenant_case_cancellation_reasons','case_hold_events','case_cancellations','case_files','case_file_product_line_links','case_product_line_fulfillment','vendor_case_packages','vendor_case_package_product_lines','vendor_case_package_files','case_operational_events'],indexes:['case_intake_profiles_lifecycle_idx','tenant_case_hold_reasons_active_idx','tenant_case_cancellation_reasons_active_idx','case_hold_events_one_open_idx','case_files_case_idx','vendor_case_packages_case_idx','case_operational_events_projection_idx'],functions:['prevent_case_file_source_mutation','prevent_case_operational_event_mutation'],triggers:['case_files_source_guard','case_operational_events_immutable']},
  '0017':{tables:['case_intake_submission_links'],indexes:['case_intake_submission_links_case_idx','case_files_submission_object_once_idx']},
  '0018':{constraints:['case_intake_submission_links_case_document_fk']}
};

type SqlClient=Client|PoolClient;
function quoteIdentifier(value:string){return `"${value.replaceAll('"','""')}"`;}
async function exists(client:SqlClient,relation:string){return Boolean((await client.query<{name:string|null}>('SELECT to_regclass(format(\'%I.%I\',current_schema(),$1::text)) AS name',[relation])).rows[0]?.name);}
async function hasColumn(client:SqlClient,table:string,column:string){return Boolean((await client.query('SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 AND column_name=$2',[table,column])).rowCount);}
async function hasFunction(client:SqlClient,name:string){return Boolean((await client.query('SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=current_schema() AND p.proname=$1',[name])).rowCount);}
async function hasTrigger(client:SqlClient,name:string){return Boolean((await client.query('SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=current_schema() AND t.tgname=$1 AND NOT t.tgisinternal',[name])).rowCount);}
async function hasConstraint(client:SqlClient,name:string){return Boolean((await client.query('SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname=current_schema() AND c.conname=$1',[name])).rowCount);}

type SchemaState='absent'|'complete'|'partial';
export async function inspectMigrationState(client:SqlClient,version:string):Promise<SchemaState>{
  const requirement=requirements[version];
  if(!requirement)throw new Error(`No legacy-adoption fingerprint exists for migration ${version}.`);
  const checks:boolean[]=[];
  for(const table of requirement.tables??[])checks.push(await exists(client,table));
  for(const [table,column] of requirement.columns??[])checks.push(await hasColumn(client,table,column));
  for(const index of requirement.indexes??[])checks.push(await exists(client,index));
  for(const fn of requirement.functions??[])checks.push(await hasFunction(client,fn));
  for(const trigger of requirement.triggers??[])checks.push(await hasTrigger(client,trigger));
  for(const constraint of requirement.constraints??[])checks.push(await hasConstraint(client,constraint));
  if(requirement.templateCount!==undefined){
    if(await exists(client,'product_catalog_templates')){
      const row=await client.query<{count:string}>('SELECT count(*)::text AS count FROM product_catalog_templates');
      checks.push(Number(row.rows[0]?.count??0)===requirement.templateCount);
    }else checks.push(false);
  }
  if(requirement.templateCopiesForExistingTenants){
    if(await exists(client,'tenants')&&await exists(client,'product_catalog')&&await exists(client,'product_catalog_templates')&&await hasColumn(client,'product_catalog','sku')&&await hasColumn(client,'product_catalog_templates','sku')){
      const row=await client.query<{count:string}>(`SELECT count(*)::text AS count
        FROM tenants t
        WHERE t.deleted_at IS NULL
          AND (SELECT count(DISTINCT p.sku)
               FROM product_catalog p
               JOIN product_catalog_templates template ON template.sku=p.sku
               WHERE p.tenant_id=t.id)<>(SELECT count(*) FROM product_catalog_templates)`);
      checks.push(Number(row.rows[0]?.count??0)===0);
    }else checks.push(false);
  }
  if(requirement.caseJourneyCopiesForExistingCases){
    if(await exists(client,'repository_documents')&&await exists(client,'case_journey_cases')){
      const row=await client.query<{count:string}>(`SELECT count(*)::text AS count FROM repository_documents document
        WHERE document.entity_type='case' AND document.deleted_at IS NULL
          AND NOT EXISTS(SELECT 1 FROM case_journey_cases journey WHERE journey.tenant_id=document.tenant_id AND journey.case_id=document.entity_id)`);
      checks.push(Number(row.rows[0]?.count??0)===0);
    }else checks.push(false);
  }
  if(checks.every(Boolean))return 'complete';
  if(checks.every(value=>!value))return 'absent';
  return 'partial';
}

async function ensureLedger(client:SqlClient){
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    filename text NOT NULL UNIQUE,
    checksum_sha256 text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now(),
    execution_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
  )`);
}

async function checksum(directory:string,filename:string){return createHash('sha256').update(await readFile(resolve(directory,filename))).digest('hex');}

async function record(client:SqlClient,migration:MigrationDefinition,hash:string,mode:'applied'|'legacy-adopted'){
  await client.query('INSERT INTO schema_migrations(version,filename,checksum_sha256,execution_metadata) VALUES($1,$2,$3,jsonb_build_object(\'mode\',$4::text))',[migration.version,migration.filename,hash,mode]);
}

export async function runMigrations(options:MigrationRunOptions):Promise<MigrationRunResult>{
  const migrationDirectory=options.migrationDirectory??defaultMigrationDirectory;
  const ordered=options.migrations??await loadMigrations(migrationDirectory);
  const client=new Client({connectionString:options.connectionString});
  const result:MigrationRunResult={applied:[],adopted:[],skipped:[]};
  try{
    await client.connect();
    if(options.schema)await client.query(`SET search_path TO ${quoteIdentifier(options.schema)}, public`);
    await client.query("SELECT pg_advisory_lock(hashtext('cadence-northstar-schema-migrations-v1'))");
    await ensureLedger(client);
    const hashes=new Map<string,string>();
    for(const migration of ordered)hashes.set(migration.version,await checksum(migrationDirectory,migration.filename));
    const ledger=await client.query<{version:string;filename:string;checksum_sha256:string}>('SELECT version,filename,checksum_sha256 FROM schema_migrations ORDER BY version');
    const byVersion=new Map(ledger.rows.map(row=>[row.version,row]));
    for(const row of ledger.rows){
      const expected=ordered.find(migration=>migration.version===row.version);
      if(!expected)throw new Error(`Migration ledger contains unknown version ${row.version}; refusing to continue.`);
      if(row.filename!==expected.filename||row.checksum_sha256!==hashes.get(row.version))throw new Error(`Checksum drift detected for applied migration ${row.version}; refusing to continue.`);
    }
    let ledgerGap=false;
    for(const migration of ordered){
      if(byVersion.has(migration.version)){if(ledgerGap)throw new Error(`Migration ledger is non-contiguous at ${migration.version}; refusing to continue.`);}
      else ledgerGap=true;
    }
    const states=new Map<string,SchemaState>();
    let reachedAbsent=false;
    for(const [position,migration] of ordered.entries()){
      if(byVersion.has(migration.version))continue;
      const hasFingerprint=Boolean(requirements[migration.version]);
      if(!hasFingerprint&&!ordered.slice(0,position).every(previous=>byVersion.has(previous.version)))throw new Error(`Migration ${migration.version} has no legacy-adoption fingerprint; refusing an untracked schema state.`);
      const state=hasFingerprint?await inspectMigrationState(client,migration.version):'absent';
      if(state==='partial')throw new Error(`PARTIAL_${migration.version}: schema fingerprint is incomplete; refusing migration adoption.`);
      if(state==='complete'&&reachedAbsent)throw new Error(`Non-contiguous legacy migration state at ${migration.version}; refusing migration adoption.`);
      if(state==='absent')reachedAbsent=true;
      states.set(migration.version,state);
    }
    for(const migration of ordered){
      if(byVersion.has(migration.version)){result.skipped.push(migration.version);continue;}
      const state=states.get(migration.version)!;
      if(state==='complete'){
        await record(client,migration,hashes.get(migration.version)!, 'legacy-adopted');
        result.adopted.push(migration.version);
        continue;
      }
      console.log(`Applying ${migration.version} ${migration.filename}`);
      await client.query(await readFile(resolve(migrationDirectory,migration.filename),'utf8'));
      await record(client,migration,hashes.get(migration.version)!, 'applied');
      result.applied.push(migration.version);
    }
    return result;
  }finally{
    try{await client.query("SELECT pg_advisory_unlock(hashtext('cadence-northstar-schema-migrations-v1'))");}catch{}
    await client.end();
  }
}
