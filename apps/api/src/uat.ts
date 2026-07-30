import { createHash, randomUUID } from 'node:crypto';
import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import type { AuditRepository } from './infrastructure/contracts.js';
import type { SecurityRequest } from './security.js';

const adminRoles = new Set(['system-administrator','laboratory-administrator','tenant-owner','tenant-administrator','platform-owner']);
const testerRoles = new Set([...adminRoles,'office-manager','customer-service','cad-technician','production-technician','ceramist','qc-technician','shipping','billing','sales','doctor','office-staff','doctor-portal-user','read-only-auditor']);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const param = (value: string | string[]) => Array.isArray(value) ? value[0] ?? '' : value;
const environment = () => text(process.env.NORTHSTAR_ENVIRONMENT) || (process.env.NODE_ENV === 'production' ? 'production' : 'development');
const build = () => text(process.env.NORTHSTAR_BUILD_VERSION) || '0.13.0-uat';
const commit = () => text(process.env.GIT_COMMIT_SHA) || 'development';

function requireIdentity(req: SecurityRequest, res: Response) {
  if (!req.identity) { res.status(401).json({ error: 'Authentication required.' }); return null; }
  return req.identity;
}
function requireRole(req: SecurityRequest, res: Response, roles: Set<string>) {
  const identity = requireIdentity(req,res);
  if (!identity) return null;
  if (!roles.has(identity.role)) { res.status(403).json({ error: 'Permission denied.' }); return null; }
  return identity;
}

export function installUatFoundation(app: Express, deps: { pool: Pool; audit: AuditRepository }) {
  const { pool, audit } = deps;
  const record = async (req: SecurityRequest, action: string, entityType: string, entityId: string, metadata: Record<string,unknown> = {}) => {
    const actor = req.identity!;
    await audit.append({ tenantId: actor.tenantId, actorId: actor.userId, actorName: actor.name, action, entityType, entityId, occurredAt: new Date().toISOString(), metadata });
  };

  app.get('/api/system/information', async (req: SecurityRequest,res) => {
    const identity=requireRole(req,res,adminRoles); if(!identity)return;
    const migration=await pool.query("SELECT COALESCE(MAX(version),'0007') AS version FROM (VALUES ('0007')) AS migrations(version)");
    return res.json({ environment: environment(), applicationVersion:'0.13.0', apiVersion:'v1', buildVersion:build(), gitCommit:commit(), migrationVersion:migration.rows[0].version, buildTimestamp:text(process.env.BUILD_TIMESTAMP)||new Date().toISOString(), tenantId:identity.tenantId });
  });

  app.get('/api/feature-flags', async (req: SecurityRequest,res) => {
    const identity=requireIdentity(req,res); if(!identity)return;
    const result=await pool.query(`SELECT id,flag_key AS "key",description,enabled,environments,roles,expires_at AS "expiresAt" FROM feature_flags WHERE tenant_id IS NULL OR tenant_id=$1 ORDER BY flag_key`,[identity.tenantId]);
    return res.json(result.rows.map(row=>({...row,effective:row.enabled&&(row.environments.length===0||row.environments.includes(environment()))&&(row.roles.length===0||row.roles.includes(identity.role))&&(!row.expiresAt||new Date(row.expiresAt)>new Date())})));
  });

  app.put('/api/feature-flags/:key', async (req: SecurityRequest,res) => {
    const identity=requireRole(req,res,adminRoles); if(!identity)return;
    const key=param(req.params.key); if(!key)return res.status(400).json({error:'Flag key is required.'});
    const enabled=Boolean(req.body?.enabled); const description=text(req.body?.description); const environments=Array.isArray(req.body?.environments)?req.body.environments:[]; const roles=Array.isArray(req.body?.roles)?req.body.roles:[];
    const result=await pool.query(`INSERT INTO feature_flags(tenant_id,flag_key,description,enabled,environments,roles,expires_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(tenant_id,flag_key) DO UPDATE SET description=EXCLUDED.description,enabled=EXCLUDED.enabled,environments=EXCLUDED.environments,roles=EXCLUDED.roles,expires_at=EXCLUDED.expires_at,updated_at=now() RETURNING *`,[identity.tenantId,key,description,enabled,environments,roles,req.body?.expiresAt||null,identity.userId]);
    await record(req,'feature-flag.updated','feature-flag',key,{enabled}); return res.json(result.rows[0]);
  });

  app.get('/api/uat/plans', async (req: SecurityRequest,res) => {
    const identity=requireRole(req,res,testerRoles); if(!identity)return;
    const result=await pool.query(`SELECT p.*,COUNT(c.id)::int AS "caseCount",COUNT(e.id) FILTER(WHERE e.status='pass')::int AS "passedCount",COUNT(e.id) FILTER(WHERE e.status='fail')::int AS "failedCount" FROM uat_test_plans p LEFT JOIN uat_test_cases c ON c.plan_id=p.id LEFT JOIN LATERAL (SELECT DISTINCT ON(test_case_id) test_case_id,status FROM uat_executions WHERE tenant_id=p.tenant_id ORDER BY test_case_id,created_at DESC)e ON e.test_case_id=c.id WHERE p.tenant_id=$1 GROUP BY p.id ORDER BY p.updated_at DESC`,[identity.tenantId]);
    return res.json(result.rows);
  });

  app.post('/api/uat/plans', async (req: SecurityRequest,res) => {
    const identity=requireRole(req,res,adminRoles); if(!identity)return;
    const name=text(req.body?.name), module=text(req.body?.module); if(!name||!module)return res.status(400).json({error:'Name and module are required.'});
    const result=await pool.query(`INSERT INTO uat_test_plans(tenant_id,name,sprint,module,description,owner_id,owner_name,status,target_environment,build_version) VALUES($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9) RETURNING *`,[identity.tenantId,name,text(req.body?.sprint)||'Sprint 13A',module,text(req.body?.description),identity.userId,identity.name,text(req.body?.targetEnvironment)||'uat',build()]);
    await record(req,'uat.plan.created','uat-plan',result.rows[0].id,{module}); return res.status(201).json(result.rows[0]);
  });

  app.get('/api/uat/plans/:id/cases', async (req: SecurityRequest,res) => {
    const identity=requireRole(req,res,testerRoles); if(!identity)return;
    const result=await pool.query(`SELECT c.*,e.id AS "executionId",e.status AS "executionStatus",e.actual_result AS "actualResult",e.notes AS "executionNotes" FROM uat_test_cases c LEFT JOIN LATERAL(SELECT * FROM uat_executions WHERE tenant_id=c.tenant_id AND test_case_id=c.id ORDER BY created_at DESC LIMIT 1)e ON true WHERE c.tenant_id=$1 AND c.plan_id=$2 ORDER BY c.sort_order,c.created_at`,[identity.tenantId,param(req.params.id)]);
    return res.json(result.rows);
  });

  app.post('/api/uat/plans/:id/cases', async (req: SecurityRequest,res) => {
    const identity=requireRole(req,res,adminRoles); if(!identity)return;
    const title=text(req.body?.title), expected=text(req.body?.expectedResult); if(!title||!expected)return res.status(400).json({error:'Title and expected result are required.'});
    const result=await pool.query(`INSERT INTO uat_test_cases(tenant_id,plan_id,title,category,preconditions,steps,expected_result,related_module,priority,severity,assigned_role,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[identity.tenantId,param(req.params.id),title,text(req.body?.category)||'workflow',text(req.body?.preconditions),JSON.stringify(Array.isArray(req.body?.steps)?req.body.steps:[]),expected,text(req.body?.relatedModule)||'General',text(req.body?.priority)||'medium',text(req.body?.severity)||'medium',text(req.body?.assignedRole)||null,Number(req.body?.sortOrder)||0]);
    await record(req,'uat.case.created','uat-test-case',result.rows[0].id,{planId:param(req.params.id)}); return res.status(201).json(result.rows[0]);
  });

  app.post('/api/uat/cases/:id/execute', async (req: SecurityRequest,res) => {
    const identity=requireRole(req,res,testerRoles); if(!identity)return;
    const status=text(req.body?.status); if(!['not-run','pass','fail','blocked'].includes(status))return res.status(400).json({error:'Invalid execution status.'});
    const started=text(req.body?.startedAt)||new Date().toISOString(); const completed=new Date().toISOString();
    const result=await pool.query(`INSERT INTO uat_executions(tenant_id,test_case_id,tester_id,tester_name,environment,build_version,git_commit,started_at,completed_at,duration_seconds,status,actual_result,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,GREATEST(0,EXTRACT(EPOCH FROM($9::timestamptz-$8::timestamptz))::int),$10,$11,$12) RETURNING *`,[identity.tenantId,param(req.params.id),identity.userId,identity.name,environment()==='production'?'uat':environment(),build(),commit(),started,completed,status,text(req.body?.actualResult),text(req.body?.notes)]);
    await record(req,'uat.execution.recorded','uat-execution',result.rows[0].id,{testCaseId:param(req.params.id),status}); return res.status(201).json(result.rows[0]);
  });

  app.get('/api/uat/defects', async (req: SecurityRequest,res) => { const identity=requireRole(req,res,testerRoles);if(!identity)return;const result=await pool.query('SELECT * FROM uat_defects WHERE tenant_id=$1 ORDER BY updated_at DESC',[identity.tenantId]);return res.json(result.rows); });
  app.post('/api/uat/defects', async (req: SecurityRequest,res) => {
    const identity=requireRole(req,res,testerRoles);if(!identity)return;const title=text(req.body?.title),description=text(req.body?.description);if(!title||!description)return res.status(400).json({error:'Title and description are required.'});
    const count=await pool.query('SELECT COUNT(*)::int AS count FROM uat_defects WHERE tenant_id=$1',[identity.tenantId]);const number=`DEF-${String(Number(count.rows[0].count)+1).padStart(4,'0')}`;
    const result=await pool.query(`INSERT INTO uat_defects(tenant_id,defect_number,title,description,environment,module,sprint,severity,priority,status,reporter_id,reporter_name,related_test_case_id,related_build,related_git_commit,role_context) VALUES($1,$2,$3,$4,$5,$6,'Sprint 13A',$7,$8,'new',$9,$10,$11,$12,$13,$14) RETURNING *`,[identity.tenantId,number,title,description,environment()==='production'?'uat':environment(),text(req.body?.module)||'General',text(req.body?.severity)||'medium',text(req.body?.priority)||'medium',identity.userId,identity.name,text(req.body?.relatedTestCaseId)||null,build(),commit(),identity.role]);
    await record(req,'uat.defect.created','uat-defect',result.rows[0].id,{defectNumber:number});return res.status(201).json(result.rows[0]);
  });
  app.patch('/api/uat/defects/:id', async (req: SecurityRequest,res) => {
    const identity=requireRole(req,res,testerRoles);if(!identity)return;const allowed=['new','triaged','in-progress','ready-for-retest','verified','closed'];const status=text(req.body?.status);if(!allowed.includes(status))return res.status(400).json({error:'Invalid defect status.'});
    const result=await pool.query(`UPDATE uat_defects SET status=$3,assignee_id=COALESCE($4,assignee_id),assignee_name=COALESCE($5,assignee_name),resolution_notes=COALESCE($6,resolution_notes),updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING *`,[identity.tenantId,param(req.params.id),status,text(req.body?.assigneeId)||null,text(req.body?.assigneeName)||null,text(req.body?.resolutionNotes)||null]);if(!result.rowCount)return res.status(404).json({error:'Defect not found.'});await record(req,'uat.defect.status.changed','uat-defect',param(req.params.id),{status});return res.json(result.rows[0]);
  });

  app.get('/api/uat/readiness', async (req: SecurityRequest,res) => {
    const identity=requireRole(req,res,testerRoles);if(!identity)return;
    const result=await pool.query(`SELECT (SELECT COUNT(*)::int FROM uat_test_cases WHERE tenant_id=$1) AS total,(SELECT COUNT(DISTINCT test_case_id)::int FROM uat_executions WHERE tenant_id=$1 AND status='pass') AS passed,(SELECT COUNT(*)::int FROM uat_defects WHERE tenant_id=$1 AND severity IN('critical','high') AND status NOT IN('verified','closed')) AS blockers`,[identity.tenantId]);const row=result.rows[0];return res.json({...row,ready:row.total>0&&row.passed===row.total&&row.blockers===0,buildVersion:build(),gitCommit:commit(),environment:environment()});
  });

  app.post('/api/uat/seed', async (req: SecurityRequest,res) => {
    const identity=requireRole(req,res,adminRoles);if(!identity)return;if(!['development','uat'].includes(environment()))return res.status(403).json({error:'Seed operations are unavailable in this environment.'});
    const checksum=createHash('sha256').update('northstar-uat-seed-v1').digest('hex');
    const run=await pool.query(`INSERT INTO uat_seed_runs(tenant_id,seed_version,environment,scenario_ids,checksum,status,created_by,completed_at) VALUES($1,'v1',$2,$3,$4,'complete',$5,now()) RETURNING *`,[identity.tenantId,environment(),['role-routing','digital-intake','communications','qc','shipping','billing'],checksum,identity.userId]);
    const plan=await pool.query(`INSERT INTO uat_test_plans(tenant_id,name,sprint,module,description,owner_id,owner_name,status,target_environment,build_version) SELECT $1,'Community Preview 2 Regression','Sprint 13A','Platform','Validate role routing, navigation, persistence and implemented ERP workflows.',$2,$3,'ready',$4,$5 WHERE NOT EXISTS(SELECT 1 FROM uat_test_plans WHERE tenant_id=$1 AND name='Community Preview 2 Regression') RETURNING id`,[identity.tenantId,identity.userId,identity.name,environment(),build()]);
    const planId=plan.rows[0]?.id ?? (await pool.query("SELECT id FROM uat_test_plans WHERE tenant_id=$1 AND name='Community Preview 2 Regression'",[identity.tenantId])).rows[0].id;
    const cases=[['Secure login and role landing','Authentication','User can sign in and reaches the correct role dashboard.','critical'],['Navigation has no dead ends','Navigation','Every enabled navigation item loads without a runtime error.','high'],['Digital Intake persists','Digital Intake','A submission and prescription persist after logout and login.','critical'],['Communications remain authorized','Communications','Timeline access remains Practice and tenant scoped.','critical'],['QC workflow remains stable','QC','Inspection results persist and update the case workflow.','high'],['Shipping and billing remain stable','Billing','Delivered shipment and invoice records remain available.','high']];
    for(let index=0;index<cases.length;index++){const item=cases[index];await pool.query(`INSERT INTO uat_test_cases(tenant_id,plan_id,title,category,preconditions,steps,expected_result,related_module,priority,severity,sort_order) SELECT $1,$2,$3,$4,'Seed data loaded',$5,$6,$4,'high',$7,$8 WHERE NOT EXISTS(SELECT 1 FROM uat_test_cases WHERE tenant_id=$1 AND plan_id=$2 AND title=$3)`,[identity.tenantId,planId,item[0],item[1],JSON.stringify(['Open module','Perform scenario','Verify result','Refresh and re-check']),item[2],item[3],index]);}
    await record(req,'uat.seed.completed','uat-seed-run',run.rows[0].id,{checksum});return res.status(201).json({run:run.rows[0],planId});
  });
}
