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

test('uses the authoritative patient name in Case Intake selectors', async ({ page }) => {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Operations Overview' })).toBeVisible();

  await page.getByRole('button', { name: 'Patients' }).click();
  await expect(page.getByRole('heading', { name: 'Patient Management' })).toBeVisible();
  await page.getByLabel('Patient reference').fill('F7-IDENTITY');
  await page.getByLabel('Patient first name').fill('Marissa');
  await page.getByLabel('Patient last name').fill('Lugo');
  const createPatient = page.waitForResponse(response => response.url().endsWith('/api/patients') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create patient' }).click();
  await expect((await createPatient).status()).toBe(201);

  await page.getByRole('button', { name: 'Cases' }).click();
  await expect(page.getByRole('heading', { name: 'Case Intake' })).toBeVisible();
  await expect(page.getByLabel('Case patient').locator('option')).toContainText('F7-IDENTITY — Lugo, Marissa');
  await expect(page.getByLabel('Shade')).toHaveAttribute('placeholder', 'e.g., A2');
  await expect(page.getByLabel('Prescription notes')).toHaveAttribute('placeholder', 'e.g., Verify proximal contacts; return with model');

  await page.getByRole('button', { name: 'Product & Pricing' }).click();
  await expect(page.getByRole('heading', { name: 'Tenant Product Catalog' })).toBeVisible();
  await expect(page.getByLabel('Product pricing overview')).toBeVisible();
  await expect(page.getByLabel('Custom product SKU')).toHaveAttribute('placeholder', 'e.g., MAD-ADJ');
});
