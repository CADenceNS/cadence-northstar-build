import { expect, test } from '@playwright/test';

const email='dorianhabet@yahoo.com';const password='NorthStar!2026';
async function login(page){await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();await page.getByLabel('Email').fill(email);await page.getByLabel('Password').fill(password);await page.getByRole('button',{name:'Sign in'}).click();await expect(page.getByRole('heading',{name:'Laboratory Status'})).toBeVisible()}

test('production workflow routes a case through every department',async({page,request})=>{
 const patient=await request.post('http://127.0.0.1:4000/api/patients',{data:{practiceId:'practice-1',doctorId:'doctor-1',patientReference:'SPR5-001',firstName:'Jordan',lastName:'Lee',dateOfBirth:'1992-04-10',status:'active',notes:'Production workflow test'}});expect(patient.ok()).toBeTruthy();const patientData=await patient.json();
 const clinicalCase=await request.post('http://127.0.0.1:4000/api/cases',{data:{patientId:patientData.id,practiceId:'practice-1',doctorId:'doctor-1',status:'received',toothNumbers:[30],arch:'mandibular',restoration:'Implant Crown',material:'Zirconia',shade:'A2',stumpShade:'ND2',rushPriority:'rush',receivedDate:new Date().toISOString().slice(0,10),prescriptionNotes:'Sprint 5 full production route'}});expect(clinicalCase.ok()).toBeTruthy();const caseData=await clinicalCase.json();
 await login(page);await page.getByRole('button',{name:'Production'}).click();await expect(page.getByRole('heading',{name:'Production Workflow',level:1})).toBeVisible();await page.getByLabel('Production case').selectOption(caseData.id);await page.getByRole('button',{name:'Create production work item'}).click();await expect(page.getByText(caseData.caseNumber)).toBeVisible();
 await page.getByRole('button',{name:'Start'}).click();for(const name of ['Case Review','Model','CAD','Manufacturing','Ceramics','QC','Shipping']){await page.getByRole('button',{name:`Move to ${name}`}).click();await expect(page.getByText(name,{exact:true})).toBeVisible()}
 await page.getByRole('button',{name:'Complete'}).click();await expect(page.getByText('completed',{exact:true})).toBeVisible();await expect(page.getByText(/events/)).toBeVisible();
 await page.getByRole('button',{name:'Laboratory'}).click();await expect(page.getByText('Production in progress')).toBeVisible();await expect(page.getByText('Production overdue')).toBeVisible();await expect(page.getByRole('heading',{name:'Production workload'})).toBeVisible();
});
