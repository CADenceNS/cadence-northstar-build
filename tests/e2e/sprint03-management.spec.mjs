import { expect, test } from '@playwright/test';

const email = 'dorianhabet@yahoo.com';
const password = 'NorthStar!2026';

async function login(page, context) {
  await context.clearCookies();
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  const loginResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign in' }).click();
  expect((await loginResponse).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Laboratory Status' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('northstar.csrf'))).not.toBeNull();
}

async function recordDoctorCommunication(row, eventType, content) {
  await row.getByLabel('doctor communication type').selectOption(eventType);
  await row.getByRole('textbox', { name: 'doctor communication', exact: true }).fill(content);
  const response = row.page().waitForResponse(candidate => candidate.url().endsWith('/api/communications/events') && candidate.request().method() === 'POST');
  await row.getByRole('button', { name: 'Record communication' }).click();
  expect((await response).status()).toBe(201);
  await expect(row.getByText(content)).toBeVisible();
}

test('practice and doctor management CRUD lifecycle', async ({ page, context }) => {
  await login(page, context);

  await page.getByRole('button', { name: 'Practices' }).click();
  await expect(page.getByRole('heading', { name: 'Practice Management', level: 1 })).toBeVisible();
  await page.getByLabel('Practice name').fill('Keramos Test Practice');
  await page.getByLabel('Practice phone').fill('747-240-4008');
  await page.getByLabel('Practice email').fill('testpractice@example.com');
  await page.getByLabel('Office manager name').fill('Roxanna Test');
  await page.getByLabel('Office manager email').fill('manager@example.com');
  await page.getByLabel('Practice notes').fill('Sprint 3 verified practice.');
  const practiceResponse = page.waitForResponse(response => response.url().endsWith('/api/practices') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create practice' }).click();
  const createdPracticeResponse = await practiceResponse;
  expect(createdPracticeResponse.status()).toBe(201);
  const createdPractice = await createdPracticeResponse.json();
  expect(createdPractice.accountNumber).toMatch(/^KDL-\d+$/);
  await expect(page.getByText('Keramos Test Practice')).toBeVisible();
  await expect(page.getByText(createdPractice.accountNumber)).toBeVisible();
  await page.getByLabel('Search practices').fill('Keramos Test');
  await expect(page.getByText('Keramos Test Practice')).toBeVisible();

  await page.getByRole('button', { name: 'Doctors' }).click();
  await expect(page.getByRole('heading', { name: 'Doctor Management', level: 1 })).toBeVisible();
  await page.getByLabel('Doctor practice').selectOption({ label: 'Keramos Test Practice' });
  await page.getByLabel('Doctor first name').fill('Jamie');
  await page.getByLabel('Doctor last name').fill('Rivera');
  await page.getByLabel('Doctor email').fill('jamie.rivera@example.com');
  await page.getByLabel('Doctor notes').fill('Primary restorative contact.');
  const doctorResponse = page.waitForResponse(response => response.url().endsWith('/api/doctors') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create doctor' }).click();
  expect((await doctorResponse).status()).toBe(201);
  await expect(page.getByText('Dr. Jamie Rivera')).toBeVisible();

  await page.getByLabel('Search doctors').fill('Jamie Rivera');
  await expect(page.getByText('Dr. Jamie Rivera')).toBeVisible();
  await page.getByText('Dr. Jamie Rivera').locator('..').getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Doctor status').selectOption('inactive');
  await page.getByRole('button', { name: 'Update doctor' }).click();
  await page.getByLabel('Status filter').selectOption('inactive');
  await expect(page.getByText('Dr. Jamie Rivera')).toBeVisible();

  const doctorRow = page.getByText('Dr. Jamie Rivera').locator('..');
  await doctorRow.getByRole('button', { name: /View Communication timeline/i }).click();
  const firstCommunication = 'Discussed digital scan workflow.';
  const secondCommunication = 'Confirmed the follow-up delivery window.';
  await recordDoctorCommunication(doctorRow, 'phone-call', firstCommunication);
  await recordDoctorCommunication(doctorRow, 'doctor-message', secondCommunication);

  const timelineEntries = doctorRow.getByLabel('doctor communication timeline').locator('article');
  await expect(timelineEntries).toHaveCount(2);
  await expect(timelineEntries.nth(0)).toContainText(firstCommunication);
  await expect(timelineEntries.nth(1)).toContainText(secondCommunication);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Laboratory Status' })).toBeVisible();
  await page.getByRole('button', { name: 'Doctors' }).click();
  await page.getByLabel('Search doctors').fill('Jamie Rivera');
  await page.getByLabel('Status filter').selectOption('inactive');
  const restoredRow = page.getByText('Dr. Jamie Rivera').locator('..');
  await restoredRow.getByRole('button', { name: /View Communication timeline/i }).click();
  const restoredEntries = restoredRow.getByLabel('doctor communication timeline').locator('article');
  await expect(restoredEntries).toHaveCount(2);
  await expect(restoredEntries.nth(0)).toContainText(firstCommunication);
  await expect(restoredEntries.nth(1)).toContainText(secondCommunication);
});
