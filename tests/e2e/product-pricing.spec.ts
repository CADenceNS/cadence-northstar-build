import { expect, test } from '@playwright/test';

const email='dorianhabet@yahoo.com';
const password='NorthStar!2026';

async function login(page:any){
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  const response=page.waitForResponse((item:any)=>item.url().endsWith('/api/auth/login')&&item.request().method()==='POST');
  await page.getByRole('button',{name:'Sign in'}).click();
  expect((await response).status()).toBe(200);
  await expect(page.getByRole('heading',{name:'Operations Overview'})).toBeVisible();
}

test('tenant administrator manages the server-backed product catalog and effective price foundation',async({page})=>{
  await login(page);
  await page.getByRole('button',{name:'Product & Pricing'}).click();
  await expect(page.getByRole('heading',{name:'Tenant Product Catalog'})).toBeVisible();
  const category=page.getByLabel('Product category');
  const family=page.getByLabel('Custom product family code');
  for(const [from,to] of [['FIX','SLP'],['FIX','REM'],['REM','IMP'],['IMP','SLP'],['SLP','AUX']] as const){
    await category.selectOption(from);
    await family.fill(`${from}-CUSTOM`);
    const loaded=page.waitForResponse((item:any)=>item.url().includes(`/api/products?category=${to}`));
    await category.selectOption(to);
    expect((await loaded).status()).toBe(200);
    await expect(family).toHaveValue('');
    await expect(family).toHaveAttribute('placeholder',`${to}-CUSTOM`);
  }
  await category.selectOption('FIX');
  const zirconia=page.getByRole('button',{name:/ZIR-MONO/});
  if(await zirconia.count()){await zirconia.click();}else{
    await page.getByLabel('Custom product SKU').fill('PP1A-BROWSER');
    await page.getByLabel('Custom product name').fill('PP-1A Browser Product');
    await family.fill('FIX-BROWSER');
    await page.getByLabel('Custom product description').fill('Browser validation product.');
    await page.getByRole('button',{name:'Add tenant product'}).click();
    await expect(page.getByRole('button',{name:/PP1A-BROWSER/})).toBeVisible();
    await page.getByRole('button',{name:/PP1A-BROWSER/}).click();
  }
  await page.getByLabel('Product base amount').fill('120');
  const response=page.waitForResponse((item:any)=>item.url().includes('/api/products/')&&item.url().endsWith('/prices')&&item.request().method()==='POST');
  await page.getByRole('button',{name:'Add price version'}).click();
  const saved=await response;
  expect(saved.status()).toBe(201);
  expect(await saved.json()).toMatchObject({amount:'120.00'});
});
