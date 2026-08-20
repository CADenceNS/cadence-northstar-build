import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error('DATABASE_URL is required to apply migrations.');

const migrationDirectory=resolve(dirname(fileURLToPath(import.meta.url)),'../migrations');
const migrations=[
  '0001_infrastructure_core.sql',
  '0002_repository_documents.sql',
  '0003_identity_security.sql',
  '0004_clinical_communications.sql',
  '0005_digital_intake_platform.sql',
  '0006_intake_administration.sql',
  '0007_uat_foundation.sql',
  '0008_tenant_native_operations.sql',
  '0009_commercial_entitlements.sql',
  '0010_commercial_activation_licensing.sql'
];

const client=new Client({connectionString:databaseUrl});
try{
  await client.connect();
  for(const migration of migrations){
    console.log(`Applying ${migration}`);
    await client.query(await readFile(resolve(migrationDirectory,migration),'utf8'));
  }
  console.log('Applied migrations 0001 through 0010.');
}finally{
  await client.end();
}
