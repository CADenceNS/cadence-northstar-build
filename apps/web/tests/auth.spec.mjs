import { expect, test } from '@playwright/test';

const email = 'dorianhabet@yahoo.com';
const password = 'NorthStar!2026';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('uses the API for login and protects the application shell', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operations Overview' })).not.toBeVisible();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('incorrect');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Incorrect email or password.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operations Overview' })).not.toBeVisible();

  const loginResponse = page.waitForResponse(response =>
    response.url().endsWith('/api/auth/login') && response.request().method() === 'POST'
  );
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect((await loginResponse).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Operations Overview' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('northstar.session'))).not.toBeNull();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Operations Overview' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).not.toBeVisible();

  await page.getByRole('button', { name: 'Practices' }).click();
  await expect(page.getByRole('heading', { name: 'Practice Management' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Practice Management' })).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('northstar.session'))).toBeNull();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operations Overview' })).not.toBeVisible();
});

test('resets family-code entry when the active catalog category changes', async ({ page }) => {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Operations Overview' })).toBeVisible();

  await page.getByRole('button', { name: 'Product & Pricing' }).first().click();
  await expect(page.getByRole('heading', { name: 'Tenant Product Catalog' })).toBeVisible();
  const category = page.getByLabel('Product category');
  const family = page.getByLabel('Custom product family code');
  for (const [from, to] of [['FIX', 'SLP'], ['FIX', 'REM'], ['REM', 'IMP'], ['IMP', 'SLP'], ['SLP', 'AUX']]) {
    await category.selectOption(from);
    await family.fill(`${from}-CUSTOM`);
    const catalogResponse = page.waitForResponse(response => response.url().includes(`/api/products?category=${to}`));
    await category.selectOption(to);
    await expect((await catalogResponse).status()).toBe(200);
    await expect(family).toHaveValue('');
    await expect(family).toHaveAttribute('placeholder', `${to}-CUSTOM`);
  }
});
