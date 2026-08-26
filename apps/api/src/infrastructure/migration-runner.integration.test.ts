import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { migrations, runMigrations } from '../migration-runner.js';

const connectionString=process.env.DATABASE_URL;
if(!connectionString)throw new Error('DATABASE_URL is required.');
const migrationDirectory=new URL('../../migrations/',import.meta.url);
const quote=(identifier:string)=>`"${identifier.replaceAll('"','""')}"`;

async function clientFor(schema?:string){
  const client=new Client({connectionString});
  await client.connect();
  if(schema)await client.query(`SET search_path TO ${quote(schema)}, public`);
  return client;
}
async function withSchema(run:(schema:string)=>Promise<void>){
  const schema=`migration_runner_${randomUUID().replaceAll('-','')}`;
  const admin=await clientFor();
  await admin.query(`CREATE SCHEMA ${quote(schema)}`);
  await admin.end();
  try{await run(schema);}finally{
    const cleanup=await clientFor();
    await cleanup.query(`DROP SCHEMA IF EXISTS ${quote(schema)} CASCADE`);
    await cleanup.end();
  }
}
async function applyRaw(schema:string,count:number){
  const client=await clientFor(schema);
  try{for(const migration of migrations.slice(0,count))await client.query(await readFile(new URL(migration.filename,migrationDirectory),'utf8'));}finally{await client.end();}
}
async function createLedgerThrough(schema:string,count:number){
  const client=await clientFor(schema);
  try{
    await client.query("CREATE TABLE schema_migrations(version text PRIMARY KEY,filename text NOT NULL UNIQUE,checksum_sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now(),execution_metadata jsonb NOT NULL DEFAULT '{}'::jsonb)");
    for(const migration of migrations.slice(0,count)){
      const hash=createHash('sha256').update(await readFile(new URL(migration.filename,migrationDirectory))).digest('hex');
      await client.query('INSERT INTO schema_migrations(version,filename,checksum_sha256) VALUES($1,$2,$3)',[migration.version,migration.filename,hash]);
    }
  }finally{await client.end();}
}
async function ledgerVersions(schema:string){
  const client=await clientFor(schema);
  try{return (await client.query<{version:string}>('SELECT version FROM schema_migrations ORDER BY version')).rows.map(row=>row.version);}finally{await client.end();}
}

await withSchema(async schema=>{
  const first=await runMigrations({connectionString,schema});
  assert.deepEqual(first.applied,migrations.map(migration=>migration.version),'fresh database must apply every migration once');
  const products=await clientFor(schema);try{assert.equal((await products.query('SELECT count(*) FROM product_catalog')).rows[0].count,'87');}finally{await products.end();}
  const second=await runMigrations({connectionString,schema});
  assert.deepEqual(second.applied,[],'a second run must apply no DDL');
  assert.equal(second.skipped.length,migrations.length);
});

await withSchema(async schema=>{
  await applyRaw(schema,10);
  const result=await runMigrations({connectionString,schema});
  assert.deepEqual(result.adopted,migrations.slice(0,10).map(migration=>migration.version),'legacy 0001–0010 must be structurally adopted');
  assert.deepEqual(result.applied,['0011','0012','0013','0014'],'only missing post-legacy migrations may execute after legacy adoption');
});

await withSchema(async schema=>{
  await applyRaw(schema,11);
  const result=await runMigrations({connectionString,schema});
  assert.deepEqual(result.applied,['0012','0013','0014']);
  assert.deepEqual(result.adopted,migrations.slice(0,11).map(migration=>migration.version),'a complete untracked 0011 must be adopted before 0012 executes');
});

await withSchema(async schema=>{
  await applyRaw(schema,12);
  const client=await clientFor(schema);try{
    const tenant='00000000-0000-0000-0000-000000000099';
    await client.query("INSERT INTO tenants(id,name) VALUES($1,'Journey migration tenant')",[tenant]);
    await client.query("INSERT INTO repository_documents(tenant_id,entity_type,entity_id,payload) VALUES($1,'case','legacy-case',$2::jsonb)",[tenant,JSON.stringify({patientId:'legacy-patient',practiceId:'legacy-practice',doctorId:'legacy-doctor'})]);
  }finally{await client.end();}
  await createLedgerThrough(schema,12);
  const result=await runMigrations({connectionString,schema});assert.deepEqual(result.applied,['0013','0014']);
  const verified=await clientFor(schema);try{const row=await verified.query<{case_relationship:string;root_case_id:string;parent_case_id:string|null}>('SELECT case_relationship,root_case_id,parent_case_id FROM case_journey_cases WHERE case_id=$1',['legacy-case']);assert.deepEqual(row.rows[0],{case_relationship:'NEW',root_case_id:'legacy-case',parent_case_id:null});}finally{await verified.end();}
});

await withSchema(async schema=>{
  await applyRaw(schema,11);
  const client=await clientFor(schema);try{await client.query("DELETE FROM product_catalog WHERE sku='ZIR-MONO'");}finally{await client.end();}
  await assert.rejects(runMigrations({connectionString,schema}),/PARTIAL_0011/);
  assert.deepEqual(await ledgerVersions(schema),[],'a complete-looking 0011 without every existing-tenant template copy must fail closed');
});

await withSchema(async schema=>{
  await applyRaw(schema,10);
  const client=await clientFor(schema);try{await client.query('CREATE TABLE product_catalog_templates (id bigint PRIMARY KEY)');}finally{await client.end();}
  await assert.rejects(runMigrations({connectionString,schema}),/PARTIAL_0011/);
  assert.deepEqual(await ledgerVersions(schema),[],'partial 0011 must fail closed before any legacy ledger record is written');
});

await withSchema(async schema=>{
  await applyRaw(schema,10);
  await createLedgerThrough(schema,10);
  const result=await runMigrations({connectionString,schema});
  assert.deepEqual(result.applied,['0011','0012','0013','0014'],'an existing 0001–0010 ledger must execute only the missing migrations');
});

await withSchema(async schema=>{
  await runMigrations({connectionString,schema});
  const client=await clientFor(schema);try{await client.query("UPDATE schema_migrations SET checksum_sha256='changed' WHERE version='0011'");}finally{await client.end();}
  await assert.rejects(runMigrations({connectionString,schema}),/Checksum drift/);
});

await withSchema(async schema=>{
  const directory=await mkdtemp(resolve(tmpdir(),'northstar-migration-failure-'));
  try{
    await writeFile(resolve(directory,'0001_broken.sql'),'CREATE TABLE migration_failure_probe(id integer); SELECT 1/0;');
    await assert.rejects(runMigrations({connectionString,schema,migrationDirectory:directory,migrations:[{version:'0001',filename:'0001_broken.sql'}]}));
    assert.deepEqual(await ledgerVersions(schema),[],'a failed migration must not be recorded');
  }finally{await rm(directory,{recursive:true,force:true});}
});

await withSchema(async schema=>{
  const [first,second]=await Promise.all([runMigrations({connectionString,schema}),runMigrations({connectionString,schema})]);
  assert.deepEqual([first.applied.length,second.applied.length].sort((a,b)=>a-b),[0,migrations.length],'the advisory lock must allow exactly one concurrent DDL run');
});

console.log('Versioned migration ledger fresh/repeat/legacy/partial/checksum/failure/concurrency matrix passed.');
