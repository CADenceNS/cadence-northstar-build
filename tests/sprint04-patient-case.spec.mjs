import { expect, test } from '@playwright/test';

const email='dorianhabet@yahoo.com';
const password='NorthStar!2026';
async function login(page){await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();await page.getByLabel('Email').fill(email);await page.getByLabel('Password').fill(password);await page.getByRole('button',{name:'Sign in'}).click();await expect(page.getByRole('heading',{name:'Laboratory Status'})).toBeVisible();}

test('patient and case intake lifecycle',async({page})=>{
 await login(page);
 await page.getByRole('button',{name:'Patients'}).click();
 await expect(page.getByRole('heading',{name:'Patient Management',level:1})).toBeVisible();
 await page.getByLabel('Patient reference').fill('SPR4-001');
 await page.getByLabel('Patient first name').fill('Taylor');
 await page.getByLabel('Patient last name').fill('Morgan');
 await page.getByLabel('Patient date of birth').fill('1990-05-12');
 await page.getByLabel('Patient notes').fill('Sprint 4 clinical intake verification.');
 await page.getByRole('button',{name:'Create patient'}).click();
 await expect(page.getByText('Taylor Morgan')).toBeVisible();
 await page.getByLabel('Search patients').fill('SPR4-001');
 await expect(page.getByText('SPR4-001')).toBeVisible();

 await page.getByRole('button',{name:'Cases'}).click();
 await expect(page.getByRole('heading',{name:'Case Intake',level:1})).toBeVisible();
 await page.getByLabel('Case patient').selectOption({label:/SPR4-001/});
 await page.getByLabel('Restoration').selectOption('Implant Crown');
 await page.getByLabel('Material').selectOption('Zirconia');
 await page.getByLabel('Shade').fill('A1');
 await page.getByLabel('Stump shade').fill('ND2');
 await page.getByLabel('Rush priority').selectOption('rush');
 await page.getByLabel('Tooth 30').check();
 await page.getByLabel('Prescription notes').fill('Verify implant interface and proximal contacts.');
 await page.getByRole('button',{name:'Create case'}).click();
 await expect(page.getByText(/NS-\d{6}-001/)).toBeVisible();
 await expect(page.getByText('Implant Crown')).toBeVisible();
 await expect(page.getByText(/rush/)).toBeVisible();
 const caseNumber=await page.getByText(/NS-\d{6}-001/).first().textContent();
 const input=page.getByLabel(`Attach file to ${caseNumber}`);
 await input.setInputFiles({name:'prescription.pdf',mimeType:'application/pdf',buffer:Buffer.from('Sprint 4 RX')});
 await expect(page.getByText('rx: prescription.pdf')).toBeVisible();

 await page.getByRole('button',{name:'Laboratory'}).click();
 await expect(page.getByText('Active patients')).toBeVisible();
 await expect(page.getByText('Open cases')).toBeVisible();
 await expect(page.getByText('Rush cases')).toBeVisible();
});
