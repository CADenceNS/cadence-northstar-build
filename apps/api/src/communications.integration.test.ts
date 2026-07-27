import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { User } from '@northstar/shared';
import { createDurableRuntime } from './infrastructure/runtime.js';
import { installSecurity, SecurityService } from './security.js';
import { installCommunications } from './communications.js';

const durable=await createDurableRuntime();
const user:User={id:'usr-admin',name:'Dorian Habet',email:'dorianhabet@yahoo.com',role:'administrator',active:true};
await durable.repositories.users.save(durable.context,user);
const app=express();app.use(express.json({limit:'25mb'}));
await installSecurity(app,new SecurityService(durable.pool,durable.repositories.users,durable.repositories.audit,durable.context));
installCommunications(app,durable.pool,durable.objects);
const server=app.listen(0);await new Promise<void>(resolve=>server.once('listening',resolve));
const port=(server.address() as AddressInfo).port,base=`http://127.0.0.1:${port}`;

try{
 const login=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:'NorthStar!2026'})});assert.equal(login.status,200);const loginPayload=await login.json() as{csrfToken:string};const cookie=(login.headers.get('set-cookie')??'').split(';')[0];
 const restored=await fetch(`${base}/api/auth/session`,{headers:{Cookie:cookie}});assert.equal(restored.status,200);const sessionPayload=await restored.json() as{csrfToken:string};const csrf=sessionPayload.csrfToken;assert.notEqual(csrf,loginPayload.csrfToken,'session restoration must rotate CSRF');
 const headers={Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf};
 const threadResponse=await fetch(`${base}/api/communications/threads`,{method:'POST',headers,body:JSON.stringify({entityType:'case',entityId:'case-1001',subject:'Shade clarification'})});assert.equal(threadResponse.status,201);const thread=await threadResponse.json() as{id:string};
 const create=async(content:string,notify=false)=>{const response=await fetch(`${base}/api/communications/events`,{method:'POST',headers,body:JSON.stringify({entityType:'case',entityId:'case-1001',threadId:thread.id,eventType:'doctor-message',content,attachments:content==='Initial shade request'?[{fileName:'shade-photo.png',mimeType:'image/png',kind:'clinical-photo',contentBase64:Buffer.from('image-bytes').toString('base64')}]:[],notify:notify?[{userId:user.id,priority:'high',category:'clinical'}]:[]})});assert.equal(response.status,201);return response.json() as Promise<{id:string;attachments:Array<{fileName:string}>}>};
 const first=await create('Initial shade request',true);assert.equal(first.attachments[0]?.fileName,'shade-photo.png');
 await new Promise(resolve=>setTimeout(resolve,10));const second=await create('Doctor confirmed A2 body with translucent incisal.');
 const timeline=await fetch(`${base}/api/communications/timeline?entityType=case&entityId=case-1001`,{headers:{Cookie:cookie}});assert.equal(timeline.status,200);const events=await timeline.json() as Array<{id:string;content:string}>;assert.deepEqual(events.map(item=>item.id),[first.id,second.id],'timeline must be chronological');
 const threadEvents=await fetch(`${base}/api/communications/threads/${thread.id}`,{headers:{Cookie:cookie}});assert.equal(threadEvents.status,200);assert.equal((await threadEvents.json() as unknown[]).length,2);
 const search=await fetch(`${base}/api/communications/search?q=translucent&entityType=case`,{headers:{Cookie:cookie}});assert.equal(search.status,200);const results=await search.json() as Array<{id:string}>;assert.equal(results[0]?.id,second.id,'keyword search must find matching event');
 const notices=await fetch(`${base}/api/notifications`,{headers:{Cookie:cookie}});assert.equal(notices.status,200);const notificationRows=await notices.json() as Array<{id:string;read_at:string|null;priority:string}>;assert.equal(notificationRows[0]?.priority,'high');assert.equal(notificationRows[0]?.read_at,null);
 const marked=await fetch(`${base}/api/notifications/${notificationRows[0]?.id}/read`,{method:'POST',headers});assert.equal(marked.status,200);assert.ok((await marked.json() as{read_at:string}).read_at);
 await assert.rejects(()=>durable.pool.query('UPDATE communication_events SET content=$1 WHERE id=$2',['mutated',first.id]),/append-only/);
 await durable.pool.query(`UPDATE identity_memberships SET role='read-only-auditor',administrative_override=false WHERE tenant_id=$1 AND user_id=$2`,[durable.context.tenantId,user.id]);
 const logout=await fetch(`${base}/api/auth/logout`,{method:'POST',headers});assert.equal(logout.status,204);
 const auditorLogin=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:'NorthStar!2026'})});assert.equal(auditorLogin.status,200);const auditorPayload=await auditorLogin.json() as{csrfToken:string};const auditorCookie=(auditorLogin.headers.get('set-cookie')??'').split(';')[0];
 const denied=await fetch(`${base}/api/communications/events`,{method:'POST',headers:{Cookie:auditorCookie,'Content-Type':'application/json','X-CSRF-Token':auditorPayload.csrfToken},body:JSON.stringify({entityType:'case',entityId:'case-1001',eventType:'internal-note',content:'Denied write'})});assert.equal(denied.status,403,'read-only auditor must not create communications');
 const readable=await fetch(`${base}/api/communications/timeline?entityType=case&entityId=case-1001`,{headers:{Cookie:auditorCookie}});assert.equal(readable.status,200,'read-only auditor may retrieve timeline');
 console.log('Sprint 11 communications integration tests passed.');
}finally{server.close();await durable.pool.end()}
