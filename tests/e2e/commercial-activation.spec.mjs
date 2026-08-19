import { expect, test } from '@playwright/test';

const password=process.env.NORTHSTAR_UAT_PASSWORD??'NorthStar!2026-UAT';
const sampleTenant='00000000-0000-0000-0000-000000000002';
const csrfTokens=new WeakMap();
async function login(page,email){await page.goto('/');await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});const result=await page.evaluate(async({email,password})=>{const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});const body=await response.json();return {status:response.status,csrfToken:body.csrfToken??response.headers.get('X-CSRF-Token')??''};},{email,password});expect(result.status).toBe(200);csrfTokens.set(page,result.csrfToken);}
async function request(page,url,options={}){return page.evaluate(async({url,options,csrf})=>{const headers=new Headers(options.headers);if(!['GET','HEAD','OPTIONS'].includes((options.method??'GET').toUpperCase()))headers.set('X-CSRF-Token',csrf);const response=await fetch(url,{...options,headers});let body=null;try{body=await response.json();}catch{}return {status:response.status,body};},{url,options,csrf:csrfTokens.get(page)??''});}
const json=(body)=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

test('Platform Admin activation lifecycle is server-backed and preserves operational boundaries',async({browser,page})=>{
  const ownerContext=await browser.newContext({baseURL:'http://127.0.0.1:5173'}),ownerPage=await ownerContext.newPage();
  await login(ownerPage,'owner@sample-lab-a-uat.example');
  expect((await request(ownerPage,`/api/commercial/tenants/${sampleTenant}/activation-credentials`,json({}))).status).toBe(403);
  await login(page,'platform.owner@northstar-uat.example');
  expect((await request(page,'/api/patients')).status).toBe(403);
  const issued=await request(page,`/api/commercial/tenants/${sampleTenant}/activation-credentials`,json({reason:'browser certification'}));expect(issued.status).toBe(201);expect(issued.body.credential).toMatch(/^act_[0-9a-f-]{36}\./);const credential=issued.body.credential;
  expect((await request(page,`/api/commercial/tenants/${sampleTenant}/activate`,json({credential}))).status).toBe(200);
  expect((await request(page,`/api/commercial/tenants/${sampleTenant}/activate`,json({credential}))).status).toBe(403);
  expect((await request(page,`/api/commercial/tenants/${sampleTenant}/suspend`,json({reason:'browser suspension'}))).status).toBe(200);
  expect((await request(ownerPage,'/api/dashboard')).status).toBe(403);
  await login(page,'platform.owner@northstar-uat.example');
  expect((await request(page,`/api/commercial/tenants/${sampleTenant}/reactivate`,json({reason:'browser reactivation'}))).status).toBe(200);
  await login(ownerPage,'owner@sample-lab-a-uat.example');
  expect((await request(ownerPage,'/api/dashboard')).status).toBe(200);
  await ownerContext.close();
});
