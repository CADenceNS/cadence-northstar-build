import { expect, test } from '@playwright/test';

const password=process.env.NORTHSTAR_UAT_PASSWORD??'NorthStar!2026-UAT';
const sampleTenant='00000000-0000-0000-0000-000000000002';
const staff={one:'10000000-0000-0000-0000-000000000102',two:'10000000-0000-0000-0000-000000000103',three:'10000000-0000-0000-0000-000000000104'};
let csrfToken='';

async function login(page,email){await page.goto('/');await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});const response=await page.request.post('/api/auth/login',{data:{email,password}});const body=await response.json();expect(response.status()).toBe(200);expect(body.csrfToken).not.toBe('');csrfToken=body.csrfToken;await page.evaluate(token=>sessionStorage.setItem('northstar.csrf',token),csrfToken);}
async function request(page,url,options={}){return page.evaluate(async({url,options,csrfToken})=>{const headers=new Headers(options.headers);if(!['GET','HEAD','OPTIONS'].includes((options.method??'GET').toUpperCase()))headers.set('X-CSRF-Token',csrfToken);const response=await fetch(url,{...options,headers});let body=null;try{body=await response.json();}catch{}return{status:response.status,body};},{url,options,csrfToken});}
const json=(method,body)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

test('commercial module entitlement and independent Design Studio seats gate the live browser path',async({page})=>{
  await login(page,'platform.owner@northstar-uat.example');
  expect((await request(page,'/api/dashboard')).status).toBe(403);
  for(const userId of Object.values(staff))expect((await request(page,`/api/commercial/tenants/${sampleTenant}/seat-assignments/DESIGN_STUDIO/${userId}`,{method:'DELETE'})).status).toBe(200);
  expect((await request(page,`/api/commercial/tenants/${sampleTenant}/seat-pools/DESIGN_STUDIO`,json('PUT',{purchasedSeatCount:3}))).status).toBe(200);
  expect((await request(page,`/api/commercial/tenants/${sampleTenant}/entitlements/DESIGN_STUDIO`,json('PUT',{state:'DISABLED'}))).status).toBe(200);

  await login(page,'owner@sample-lab-a-uat.example');
  expect((await request(page,'/api/modules/DESIGN_STUDIO/access')).status).toBe(403);
  expect((await request(page,`/api/modules/DESIGN_STUDIO/access?tenantId=00000000-0000-0000-0000-000000000001`)).status).toBe(403);
  await page.goto('/design-studio.html');await expect(page.getByRole('heading',{name:'Design Studio access denied'})).toBeVisible();

  await login(page,'platform.owner@northstar-uat.example');
  expect((await request(page,`/api/commercial/tenants/${sampleTenant}/entitlements/DESIGN_STUDIO`,json('PUT',{state:'ACTIVE'}))).status).toBe(200);
  expect((await request(page,`/api/commercial/tenants/${sampleTenant}/seat-assignments`,json('POST',{moduleKey:'DESIGN_STUDIO',userId:staff.one}))).status).toBe(201);
  expect((await request(page,`/api/commercial/tenants/${sampleTenant}/seat-assignments`,json('POST',{moduleKey:'DESIGN_STUDIO',userId:staff.two}))).status).toBe(201);
  expect((await request(page,`/api/commercial/tenants/${sampleTenant}/seat-assignments`,json('POST',{moduleKey:'DESIGN_STUDIO',userId:staff.three}))).status).toBe(409);

  await login(page,'design.one@sample-lab-a-uat.example');
  expect((await request(page,'/api/modules/DESIGN_STUDIO/access')).status).toBe(200);
  await page.goto('/design-studio.html');await expect(page.getByRole('heading',{name:'Production Viewer'})).toBeVisible();
  await login(page,'design.three@sample-lab-a-uat.example');
  expect((await request(page,'/api/modules/DESIGN_STUDIO/access')).status).toBe(403);

  await login(page,'platform.owner@northstar-uat.example');
  expect((await request(page,`/api/commercial/tenants/${sampleTenant}/seat-assignments/DESIGN_STUDIO/${staff.one}`,{method:'DELETE'})).status).toBe(200);
  expect((await request(page,`/api/commercial/tenants/${sampleTenant}/seat-assignments`,json('POST',{moduleKey:'DESIGN_STUDIO',userId:staff.three}))).status).toBe(201);
  await login(page,'design.three@sample-lab-a-uat.example');
  expect((await request(page,'/api/modules/DESIGN_STUDIO/access')).status).toBe(200);
});
