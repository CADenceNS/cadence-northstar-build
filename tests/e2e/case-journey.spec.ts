import { expect, test } from '@playwright/test';

const email='dorianhabet@yahoo.com';
const password='NorthStar!2026';

async function login(page:any){
  await page.goto('/');await page.getByLabel('Email').fill(email);await page.getByLabel('Password').fill(password);
  const response=page.waitForResponse((item:any)=>item.url().endsWith('/api/auth/login')&&item.request().method()==='POST');await page.getByRole('button',{name:'Sign in'}).click();expect((await response).status()).toBe(200);
}

test('creates and previews a tenant-scoped Case Journey without duplicate product selection',async({page})=>{
  await login(page);await page.getByRole('button',{name:'Cases',exact:true}).click();await expect(page.getByRole('heading',{name:'Case Intake',level:1})).toBeVisible();await expect(page.getByLabel('Case patient')).not.toHaveValue('');await page.getByLabel('Arch selection').selectOption('maxillary');
  await page.getByRole('button',{name:'Preview case'}).click();await expect(page.getByText('CREATE PREVIEW')).toBeVisible();
  const rootResponse=page.waitForResponse((item:any)=>item.url().endsWith('/api/cases')&&item.request().method()==='POST');await page.getByRole('button',{name:'Confirm & create case'}).click();expect((await rootResponse).status()).toBe(201);
  await page.getByRole('button',{name:'Remake'}).first().click();await expect(page.getByLabel('Case relationship')).toHaveValue('REMAKE');await expect(page.getByLabel('Previous parent case')).not.toHaveValue('');
  await page.getByLabel('Remake repair reason').selectOption({index:1});await page.getByLabel('Clinic responsibility percentage').fill('50.00');await page.getByLabel('Laboratory responsibility percentage').fill('50.00');await page.getByLabel('Arch selection').selectOption('maxillary');
  await page.getByRole('button',{name:'Preview case'}).click();await expect(page.getByText('CREATE PREVIEW')).toBeVisible();await expect(page.getByText(/Parent: NS-/)).toBeVisible();
  const remakeResponse=page.waitForResponse((item:any)=>item.url().endsWith('/api/cases')&&item.request().method()==='POST');await page.getByRole('button',{name:'Confirm & create case'}).click();expect((await remakeResponse).status()).toBe(201);
  await page.getByRole('button',{name:'History'}).first().click();await expect(page.getByText('JOURNEY HISTORY')).toBeVisible();
});
