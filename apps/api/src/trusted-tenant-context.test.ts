import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { issueInternalTenantContext, resolveInternalTenantContext, trustedTenantContextMiddleware } from './trusted-tenant-context.js';

const labA={actorId:'lab-a-owner',actorName:'Lab A Owner',tenantId:'lab-a',laboratoryRole:'laboratory-administrator',platformRole:'none' as const};
const assertion=issueInternalTenantContext(labA);
assert.equal(resolveInternalTenantContext(assertion)?.tenantId,'lab-a','authenticated Lab A context must resolve to Lab A');
const labB={...labA,actorId:'lab-b-owner',actorName:'Lab B Owner',tenantId:'lab-b'};
assert.equal(resolveInternalTenantContext(issueInternalTenantContext(labB))?.tenantId,'lab-b','authenticated Lab B context must resolve independently');
assert.equal(resolveInternalTenantContext(`${assertion}tampered`),null,'tampered client assertion must fail closed');
assert.equal(resolveInternalTenantContext(issueInternalTenantContext(labA,-1)),null,'expired assertion must fail closed');
assert.throws(()=>issueInternalTenantContext({...labA,platformRole:'platform-admin'}),'platform administration must not create tenant operational context');
const requestContexts=new AsyncLocalStorage<{tenantId:string;actorId:string;actorName:string}>();
const middleware=trustedTenantContextMiddleware((context,next)=>requestContexts.run(context,next));
let propagatedTenant='';middleware({header:(name:string)=>name==='x-northstar-internal-context'?assertion:undefined} as never,{} as never,()=>{propagatedTenant=requestContexts.getStore()?.tenantId??''});
assert.equal(propagatedTenant,'lab-a','gateway-issued context must survive the operational runtime middleware path');
let rejectedStatus=0;middleware({header:()=>undefined} as never,{status:(status:number)=>{rejectedStatus=status;return{json:()=>undefined}}} as never,()=>assert.fail('missing context must not reach operational handlers'));
assert.equal(rejectedStatus,401,'missing tenant context must fail closed');
console.log('trusted tenant context tests passed');
