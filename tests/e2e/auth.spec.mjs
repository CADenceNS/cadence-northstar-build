import { expect, test } from '@playwright/test';

const email = 'dorianhabet@yahoo.com';
const password = 'NorthStar!2026';

test.beforeEach(async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
});

test('uses secure server sessions and protects the application shell', async ({ page, context }) => {
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Laboratory Status' })).not.toBeVisible();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('incorrect');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Incorrect email or password.')).toBeVisible();

  const loginResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST');
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Laboratory Status' })).toBeVisible();

  expect(await page.evaluate(() => localStorage.getItem('northstar.session'))).toBeNull();
  const sessionCookie = (await context.cookies()).find(cookie => cookie.name === 'northstar.sid');
  expect(sessionCookie).toBeDefined();
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.sameSite).toBe('Strict');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Laboratory Status' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('northstar.csrf'))).not.toBeNull();

  await page.getByRole('button', { name: 'Practices' }).click();
  await expect(page.getByRole('heading', { name: 'Practice Management', level: 1 })).toBeVisible();

  const logoutResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/logout') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign out' }).click();
  expect((await logoutResponse).status()).toBe(204);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  expect((await context.cookies()).some(cookie => cookie.name === 'northstar.sid')).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('northstar.session'))).toBeNull();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Laboratory Status' })).not.toBeVisible();
});
