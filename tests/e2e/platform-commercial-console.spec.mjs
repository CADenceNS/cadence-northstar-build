import { expect, test } from '@playwright/test';

const password=process.env.NORTHSTAR_UAT_PASSWORD??'NorthStar!2026-UAT';
const platformEmail='platform.owner@northstar-uat.example';
const tenantOwnerEmail='owner@sample-lab-a-uat.example';

async function login(page,email){
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button',{name:'Sign in'}).click();
  await expect(page.getByRole('button',{name:'Sign in'})).toHaveCount(0);
}
async function authenticateFixture(page,email){
  await page.goto('/');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  const result=await page.evaluate(async({email,password})=>{
    const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    const body=await response.json();
    return {status:response.status,csrfToken:body.csrfToken??response.headers.get('X-CSRF-Token')??''};
  },{email,password});
  expect(result.status).toBe(200);
  expect(result.csrfToken).not.toBe('');
  return result.csrfToken;
}
async function api(page,url,options={},csrfToken=''){
  return page.evaluate(async({url,options,csrfToken})=>{
    const headers=new Headers(options.headers);
    if(!['GET','HEAD','OPTIONS'].includes((options.method??'GET').toUpperCase()))headers.set('X-CSRF-Token',csrfToken);
    const response=await fetch(url,{...options,headers});
    let body=null;try{body=await response.json();}catch{}
    return {status:response.status,body};
  },{url,options,csrfToken});
}
const json=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function provisionFixture(page,name){
  const csrfToken=await authenticateFixture(page,platformEmail);
  const reference=`cf1a3b-${name}-${Date.now()}`;
  const provisioned=await api(page,'/api/commercial/tenants',json({name:`CF-1A3B ${name} Fixture`,commercialAccountReference:reference}),csrfToken);
  expect(provisioned.status).toBe(201);
  await page.reload();
  await expect(page.getByRole('heading',{name:'Platform Commercial Management'})).toBeVisible();
  return reference;
}

test('Platform Admin manages commercial state through the server-backed console without retaining activation secrets',async({browser,page})=>{
  const reference=await provisionFixture(page,'Commercial Management');
  await expect(page.getByText('Commercial administration only')).toBeVisible();
  await expect(page.getByText(/Keramos/i)).toHaveCount(0);
  expect((await api(page,'/api/patients')).status).toBe(403);

  const ownerContext=await browser.newContext({baseURL:'http://127.0.0.1:5173'});
  const ownerPage=await ownerContext.newPage();
  await authenticateFixture(ownerPage,tenantOwnerEmail);
  expect((await api(ownerPage,'/api/commercial/tenants')).status).toBe(403);

  await page.getByLabel('Search laboratories').fill(reference);
  await page.getByRole('row').filter({hasText:reference}).getByRole('button',{name:'Manage commercial account'}).click();
  await expect(page.getByRole('heading',{name:'Activation credentials'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Module entitlements'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Purchased seat limits'})).toBeVisible();

  await page.getByRole('button',{name:'Issue credential'}).click();
  const credential=await page.locator('.one-time-secret code').textContent();
  expect(credential).toMatch(/^act_[0-9a-f-]{36}\./);
  expect(await page.evaluate(value=>[localStorage,sessionStorage].every(store=>Array.from({length:store.length},(_,index)=>store.getItem(store.key(index)??'')??'').every(item=>!item.includes(value))),credential)).toBe(true);
  await page.getByRole('button',{name:'Dismiss and clear'}).click();
  await page.reload();
  await expect(page.locator('.one-time-secret')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Platform Commercial Management'})).toBeVisible();
  await page.getByLabel('Search laboratories').fill(reference);
  await page.getByRole('row').filter({hasText:reference}).getByRole('button',{name:'Manage commercial account'}).click();

  page.on('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:/Rotate activation credential/}).first().click();
  await expect(page.locator('.one-time-secret code')).toHaveText(/^act_[0-9a-f-]{36}\./);
  await page.getByRole('button',{name:'Dismiss and clear'}).click();
  await page.getByRole('button',{name:/Revoke activation credential/}).first().click();
  await expect(page.getByText('Credential revoked.')).toBeVisible();

  await page.getByRole('button',{name:'Set NORTHSTAR_CORE entitlement to ACTIVE'}).click();
  await expect(page.getByText('NORTHSTAR_CORE is now active.')).toBeVisible();
  await page.getByRole('button',{name:'Set GVM entitlement to ACTIVE'}).click();
  await expect(page.getByText('GVM is now active.')).toBeVisible();
  await page.getByRole('button',{name:'Set GVM entitlement to DISABLED'}).click();
  await expect(page.getByText('GVM is now disabled.')).toBeVisible();

  await page.getByLabel('NorthStar purchased seats').fill('5');
  await page.getByRole('button',{name:'Save NorthStar seat limit'}).click();
  await page.getByLabel('Design Studio purchased seats').fill('6');
  await page.getByRole('button',{name:'Save Design Studio seat limit'}).click();
  await expect(page.getByText('DESIGN_STUDIO seat limit saved from the commercial control plane.')).toBeVisible();

  await page.getByLabel('Reason for credential or lifecycle action').fill('CF-1A3B browser suspension check');
  await page.getByRole('button',{name:'Suspend laboratory'}).click();
  await expect(page.getByText('Laboratory suspend confirmed by the server.')).toBeVisible();
  await page.getByLabel('Reason for credential or lifecycle action').fill('CF-1A3B browser reactivation check');
  await page.getByRole('button',{name:'Reactivate laboratory'}).click();
  await expect(page.getByText('Laboratory reactivate confirmed by the server.')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Immutable commercial audit events'})).toBeVisible();
  await expect(page.getByText('commercial.tenant.reactivated').first()).toBeVisible();
  await page.getByLabel('Reason for credential or lifecycle action').fill('CF-1A3B cancellation preservation check');
  await page.getByRole('button',{name:'Cancel laboratory'}).click();
  await expect(page.getByText('Laboratory cancel confirmed by the server.')).toBeVisible();
  await expect(page.getByText('commercial.tenant.cancelled').first()).toBeVisible();
  await ownerContext.close();
});

test('Platform Admin can cancel a separately provisioned laboratory from the commercial console',async({page})=>{
  const reference=await provisionFixture(page,'Cancellation');
  await page.getByLabel('Search laboratories').fill(reference);
  await page.getByRole('row').filter({hasText:reference}).getByRole('button',{name:'Manage commercial account'}).click();
  page.on('dialog',dialog=>dialog.accept());
  await page.getByLabel('Reason for credential or lifecycle action').fill('CF-1A3B cancellation preservation check');
  await page.getByRole('button',{name:'Cancel laboratory'}).click();
  await expect(page.getByText('Laboratory cancel confirmed by the server.')).toBeVisible();
  await expect(page.getByText('CANCELLED').first()).toBeVisible();
  await expect(page.getByText('commercial.tenant.cancelled')).toBeVisible();
});
