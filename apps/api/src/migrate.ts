import { runMigrations } from './migration-runner.js';

const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error('DATABASE_URL is required to apply migrations.');

const result=await runMigrations({connectionString:databaseUrl});
console.log(`Migrations complete: applied [${result.applied.join(',')||'none'}], adopted [${result.adopted.join(',')||'none'}], skipped [${result.skipped.join(',')||'none'}].`);
