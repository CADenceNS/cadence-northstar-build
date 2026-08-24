import { expect, test } from '@playwright/test';
import { calendarDateInTimeZone } from '../../apps/web/src/business-date';

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

test('uses calendar DATE values across local-evening and DST boundaries',()=>{
  expect(calendarDateInTimeZone(new Date('2026-08-24T06:30:00.000Z'),'America/Los_Angeles')).toBe('2026-08-23');
  expect(calendarDateInTimeZone(new Date('2026-08-23T19:00:00.000Z'),'America/Los_Angeles')).toBe('2026-08-23');
  expect(calendarDateInTimeZone(new Date('2026-03-08T07:30:00.000Z'),'America/Los_Angeles')).toBe('2026-03-07');
  expect(calendarDateInTimeZone(new Date('2026-03-08T10:30:00.000Z'),'America/Los_Angeles')).toBe('2026-03-08');
  expect(calendarDateInTimeZone(new Date('2026-11-01T08:30:00.000Z'),'America/Los_Angeles')).toBe('2026-11-01');
});

test('tenant administrator manages the server-backed product catalog and effective price foundation',async({page})=>{
  await login(page);
  await page.getByRole('button',{name:'Product & Pricing'}).click();
  await expect(page.getByRole('heading',{name:'Tenant Product Catalog'})).toBeVisible();
  const category=page.getByLabel('Product category');
  const family=page.getByLabel('Custom product family code');
  const sku=page.getByLabel('Custom product SKU');
  const productName=page.getByLabel('Custom product name');
  const pricingBasis=page.getByLabel('Custom product pricing basis');
  const configuration=page.getByLabel('Custom product configuration');
  const turnaround=page.getByLabel('Custom product turnaround');
  const description=page.getByLabel('Custom product description');
  for(const [from,to] of [['FIX','SLP'],['SLP','REM'],['REM','IMP'],['IMP','AUX'],['AUX','FIX']] as const){
    await category.selectOption(from);
    await sku.fill(`${from}-TRANSIENT`);
    await productName.fill(`${from} transient product`);
    await family.fill(`${from}-CUSTOM`);
    await pricingBasis.selectOption('PER_ARCH');
    await configuration.selectOption('FULL_ARCH');
    await turnaround.fill('12');
    await description.fill(`${from} transient description`);
    const loaded=page.waitForResponse((item:any)=>item.url().includes(`/api/products?category=${to}`));
    await category.selectOption(to);
    expect((await loaded).status()).toBe(200);
    await expect(sku).toHaveValue('');
    await expect(productName).toHaveValue('');
    await expect(family).toHaveValue('');
    await expect(family).toHaveAttribute('placeholder',`${to}-CUSTOM`);
    await expect(pricingBasis).toHaveValue('PER_PRODUCT');
    await expect(configuration).toHaveValue('NONE');
    await expect(turnaround).toHaveValue('');
    await expect(description).toHaveValue('');
  }
  await category.selectOption('FIX');
  await sku.fill(`PP1A-RESET-${Date.now()}`);
  await productName.fill('PP-1A reset validation product');
  await family.fill('FIX-CUSTOM');
  await pricingBasis.selectOption('PER_ARCH');
  await configuration.selectOption('FULL_ARCH');
  await turnaround.fill('12');
  await description.fill('Must clear after successful creation.');
  await page.getByRole('button',{name:'Preview product'}).click();
  await expect(page.getByText('PP-1A reset validation product')).toBeVisible();
  const created=page.waitForResponse((item:any)=>item.url().endsWith('/api/products')&&item.request().method()==='POST');
  await page.getByRole('button',{name:'Confirm & save'}).click();
  expect((await created).status()).toBe(201);
  await expect(sku).toHaveValue('');
  await expect(productName).toHaveValue('');
  await expect(family).toHaveValue('');
  await expect(pricingBasis).toHaveValue('PER_PRODUCT');
  await expect(configuration).toHaveValue('NONE');
  await expect(turnaround).toHaveValue('');
  await expect(description).toHaveValue('');
  const zirconia=page.getByRole('button',{name:/ZIR-MONO/});
  if(await zirconia.count()){await zirconia.click();}else{
    await page.getByLabel('Custom product SKU').fill('PP1A-BROWSER');
    await page.getByLabel('Custom product name').fill('PP-1A Browser Product');
    await family.fill('FIX-BROWSER');
    await page.getByLabel('Custom product description').fill('Browser validation product.');
    await page.getByRole('button',{name:'Preview product'}).click();
    await page.getByRole('button',{name:'Confirm & save'}).click();
    await expect(page.getByRole('button',{name:/PP1A-BROWSER/})).toBeVisible();
    await page.getByRole('button',{name:/PP1A-BROWSER/}).click();
  }
  const effectiveFrom=page.getByLabel('Product price effective from');
  const localToday=await page.evaluate(()=>{const value=new Date();return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;});
  await expect(effectiveFrom).toHaveValue(localToday);
  await page.getByLabel('Product base amount').fill('120');
  await effectiveFrom.fill('2026-12-15');
  const response=page.waitForResponse((item:any)=>item.url().includes('/api/products/')&&item.url().endsWith('/prices')&&item.request().method()==='POST');
  await page.getByRole('button',{name:'Preview price version'}).click();
  await page.getByRole('button',{name:'Confirm price version'}).click();
  const saved=await response;
  expect(saved.status()).toBe(201);
  expect(await saved.json()).toMatchObject({amount:'120.00',effective_from:'2026-12-15T00:00:00.000Z'});
  await page.reload();
  await page.getByRole('button',{name:'Product & Pricing'}).click();
  await page.getByRole('button',{name:/ZIR-MONO|PP1A-BROWSER/}).click();
  await expect(page.getByText('2026-12-15 → open')).toBeVisible();
});
