import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { User } from '@northstar/shared';
import { createDurableRuntime } from './infrastructure/runtime.js';
import { installSecurity, SecurityService } from './security.js';

const durable=await createDurableRuntime();
const user:User={id:'usr-admin',name:'Dorian Habet',email:'dorianhabet@yahoo.com',role:'administrator',active:true};
await durable.repositories.users.save(durable.context,user);
const service=new SecurityService(durable.pool,durable.repositories.users,durable.repositories.audit,durable.context);
const app=express();app.use(express.json());await installSecurity(app,service);app.get('/api/dashboard',(_req,res)=>res.json({ok:true}));app.post('/api/practices',(_req,res)=>res.status(201).json({ok:true}));
const server=app.listen(0);await new Promise<void>(resolve=>server.once('listening',resolve));
const port=(server.address() as AddressInfo).port,base=`http://127.0.0.1:${port}`;

try{
 const anonymous=await fetch(`${base}/api/dashboard`);assert.equal(anonymous.status,401,'protected endpoint must reject anonymous requests');
 const login=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:'NorthStar!2026'})});assert.equal(login.status,200,'valid credentials must create a session');
 const payload=await login.json() as {csrfToken:string;user:User};assert.equal(payload.user.id,user.id);assert.ok(payload.csrfToken.length>=24);
 const setCookie=login.headers.get('set-cookie')??'';assert.match(setCookie,/northstar\.sid=/);assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/SameSite=Strict/i);const cookie=setCookie.split(';')[0];
 const current=await fetch(`${base}/api/auth/session`,{headers:{Cookie:cookie}});assert.equal(current.status,200,'server-side session must restore identity');
 const missingCsrf=await fetch(`${base}/api/practices`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:'{}'});assert.equal(missingCsrf.status,403,'mutations must reject missing CSRF token');
 const allowed=await fetch(`${base}/api/practices`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':payload.csrfToken},body:'{}'});assert.equal(allowed.status,201,'authorized mutation with CSRF must pass');
 const logout=await fetch(`${base}/api/auth/logout`,{method:'POST',headers:{Cookie:cookie,'X-CSRF-Token':payload.csrfToken}});assert.equal(logout.status,204);
 const revoked=await fetch(`${base}/api/dashboard`,{headers:{Cookie:cookie}});assert.equal(revoked.status,401,'logout must invalidate the server-side session');

 await durable.pool.query(`UPDATE identity_memberships SET role='read-only-auditor',administrative_override=false WHERE tenant_id=$1 AND user_id=$2`,[durable.context.tenantId,user.id]);
 const auditorLogin=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:'NorthStar!2026'})});assert.equal(auditorLogin.status,200);const auditorPayload=await auditorLogin.json() as {csrfToken:string};const auditorCookie=(auditorLogin.headers.get('set-cookie')??'').split(';')[0];
 const denied=await fetch(`${base}/api/practices`,{method:'POST',headers:{Cookie:auditorCookie,'Content-Type':'application/json','X-CSRF-Token':auditorPayload.csrfToken},body:'{}'});assert.equal(denied.status,403,'read-only role must be denied write permission');
 await durable.pool.query(`UPDATE identity_memberships SET role='system-administrator',administrative_override=true WHERE tenant_id=$1 AND user_id=$2`,[durable.context.tenantId,user.id]);

 for(let attempt=0;attempt<5;attempt++){const failed=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:'incorrect-password'})});assert.equal(failed.status,401)}
 const locked=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:'NorthStar!2026'})});assert.equal(locked.status,423,'lockout must block correct credentials during lock period');
 await durable.pool.query(`UPDATE identity_credentials SET failed_attempts=0,locked_until=NULL WHERE tenant_id=$1 AND user_id=$2`,[durable.context.tenantId,user.id]);

 const auditCount=await durable.pool.query<{count:string}>(`SELECT count(*)::text AS count FROM audit_events WHERE action IN ('authentication.login','authentication.logout','authorization.denied','authorization.csrf')`);assert.ok(Number(auditCount.rows[0]?.count??0)>=5,'security actions must be immutably audited');
 console.log('Sprint 10 security integration tests passed.');
}finally{server.close();await durable.pool.end()}
