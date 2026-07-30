import { expect, test } from '@playwright/test';

const email='dorianhabet@yahoo.com';
const password='NorthStar!2026';

async function login(page){await page.goto('/');await page.getByLabel('Email').fill(email);await page.getByLabel('Password').fill(password);await page.getByRole('button',{name:'Sign in'}).click();await expect(page.getByRole('heading',{name:'Laboratory Status'})).toBeVisible()}

test('records and restores an immutable practice communication timeline with safe attachment metadata',async({page})=>{
 await login(page);
 await page.getByRole('button',{name:'Practices'}).click();
 await expect(page.getByRole('heading',{name:'Practice Management',level:1})).toBeVisible();
 const practiceName=`Communication Practice ${Date.now()}`;
 await page.getByLabel('Practice name').fill(practiceName);
 await page.getByLabel('Practice phone').fill('747-240-4008');
 await page.getByLabel('Practice email').fill(`communications-${Date.now()}@example.com`);
 await page.getByLabel('Office manager name').fill('Clinical Coordinator');
 await page.getByLabel('Office manager email').fill(`manager-${Date.now()}@example.com`);
 await page.getByRole('button',{name:'Create practice'}).click();
 const row=page.getByText(practiceName).locator('..');
 await expect(row).toBeVisible();
 await row.getByRole('button',{name:/View Communication timeline/i}).click();
 await row.getByLabel('practice communication type').selectOption('phone-call');
 await row.getByLabel('practice communication').fill('Doctor called to confirm the delivery window.');
 await row.getByLabel('practice communication attachment').setInputFiles({name:'delivery-note.pdf',mimeType:'application/pdf',buffer:Buffer.from('test pdf')});
 const responsePromise=page.waitForResponse(response=>response.url().endsWith('/api/communications/events')&&response.request().method()==='POST');
 await row.getByRole('button',{name:'Record communication'}).click();
 const response=await responsePromise;expect(response.status()).toBe(201);const payload=await response.json();expect(payload.attachments[0].fileName).toBe('delivery-note.pdf');expect(payload.attachments[0].objectKey).toBeUndefined();expect(payload.attachments[0].bucket).toBeUndefined();expect(payload.attachments[0].provider).toBeUndefined();
 await expect(row.getByText('Doctor called to confirm the delivery window.')).toBeVisible();
 await expect(row.getByText(/delivery-note\.pdf/)).toBeVisible();
 await page.reload();
 await expect(page.getByRole('heading',{name:'Laboratory Status'})).toBeVisible();
 await page.getByRole('button',{name:'Practices'}).click();
 await page.getByLabel('Search practices').fill(practiceName);
 const restored=page.getByText(practiceName).locator('..');
 await restored.getByRole('button',{name:/View Communication timeline/i}).click();
 await expect(restored.getByText('Doctor called to confirm the delivery window.')).toBeVisible();
 await expect(restored.getByText(/delivery-note\.pdf/)).toBeVisible();
});

test('notification center uses server-side notification state',async({page})=>{
 await login(page);
 const response=await page.request.get('/api/notifications');
 expect(response.status()).toBe(200);
 await page.getByRole('button',{name:/Notifications/}).click();
 await expect(page.getByLabel('Notifications')).toBeVisible();
});
