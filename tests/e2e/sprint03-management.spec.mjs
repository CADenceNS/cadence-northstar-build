import { expect, test } from '@playwright/test';

const email = 'dorianhabet@yahoo.com';
const password = 'NorthStar!2026';

async function login(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Laboratory Status' })).toBeVisible();
}

test('practice and doctor management CRUD lifecycle', async ({ page }) => {
  await login(page);

  await page.getByRole('button', { name: 'Practices' }).click();
  await expect(page.getByRole('heading', { name: 'Practice Management', level: 1 })).toBeVisible();
  await page.getByLabel('Practice name').fill('Keramos Test Practice');
  await page.getByLabel('Practice phone').fill('747-240-4008');
  await page.getByLabel('Practice email').fill('testpractice@example.com');
  await page.getByLabel('Office manager name').fill('Roxanna Test');
  await page.getByLabel('Office manager email').fill('manager@example.com');
  await page.getByLabel('Practice notes').fill('Sprint 3 verified practice.');
  await page.getByRole('button', { name: 'Create practice' }).click();
  await expect(page.getByText('Keramos Test Practice')).toBeVisible();
  await expect(page.getByText('KDL-1002')).toBeVisible();
  await page.getByLabel('Search practices').fill('Keramos Test');
  await expect(page.getByText('Keramos Test Practice')).toBeVisible();

  await page.getByRole('button', { name: 'Doctors' }).click();
  await expect(page.getByRole('heading', { name: 'Doctor Management', level: 1 })).toBeVisible();
  await page.getByLabel('Doctor practice').selectOption({ label: 'Keramos Test Practice' });
  await page.getByLabel('Doctor first name').fill('Jamie');
  await page.getByLabel('Doctor last name').fill('Rivera');
  await page.getByLabel('Doctor email').fill('jamie.rivera@example.com');
  await page.getByLabel('Doctor notes').fill('Primary restorative contact.');
  await page.getByRole('button', { name: 'Create doctor' }).click();
  await expect(page.getByText('Dr. Jamie Rivera')).toBeVisible();

  await page.getByLabel('Search doctors').fill('Jamie Rivera');
  await expect(page.getByText('Dr. Jamie Rivera')).toBeVisible();
  await page.getByText('Dr. Jamie Rivera').locator('..').getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Doctor status').selectOption('inactive');
  await page.getByRole('button', { name: 'Update doctor' }).click();
  await page.getByLabel('Status filter').selectOption('inactive');
  await expect(page.getByText('Dr. Jamie Rivera')).toBeVisible();

  await page.getByLabel('Communication note').last().fill('Discussed digital scan workflow.');
  await page.getByRole('button', { name: 'Add communication' }).last().click();
  await expect(page.getByText('Discussed digital scan workflow.')).toBeVisible();
});