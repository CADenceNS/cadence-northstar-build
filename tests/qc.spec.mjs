import { expect, test } from '@playwright/test';

const email='dorianhabet@yahoo.com';
const password='NorthStar!2026';

async function login(page){await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();await page.getByLabel('Email').fill(email);await page.getByLabel('Password').fill(password);await page.getByRole('button',{name:'Sign in'}).click();await expect(page.getByRole('heading',{name:'Laboratory Status'})).toBeVisible();}

test('quality control inspection, sign-off, history, photo, and metrics lifecycle',async({page,request})=>{
 await login(page);
 const patientResponse=await request.post('http://127.0.0.1:4000/api/patients',{data:{practiceId:'practice-1',doctorId:'doctor-1',patientReference:'QC-S6-001',firstName:'Quality',lastName:'Patient',dateOfBirth:'1992-03-15',status:'active',notes:'Sprint 6 QC patient'}});
 expect(patientResponse.ok()).toBeTruthy();
 const patient=await patientResponse.json();
 const caseResponse=await request.post('http://127.0.0.1:4000/api/cases',{data:{patientId:patient.id,practiceId:'practice-1',doctorId:'doctor-1',status:'qc',toothNumbers:[30],arch:'mandibular',restoration:'Implant Crown',material:'Zirconia',shade:'A2',stumpShade:'ND2',rushPriority:'standard',receivedDate:new Date().toISOString().slice(0,10),prescriptionNotes:'Verify implant interface, contacts, occlusion, shade, and anatomy.'}});
 expect(caseResponse.ok()).toBeTruthy();
 const clinicalCase=await caseResponse.json();
 await page.getByRole('button',{name:'Quality Control'}).click();
 await expect(page.getByRole('heading',{name:'Quality Control',level:1})).toBeVisible();
 await page.getByLabel('QC case').selectOption(clinicalCase.id);
 await expect(page.getByLabel('Inspection template')).toHaveValue('template-fixed');
 await page.getByLabel('Internal fit and seating verified').selectOption('fail');
 await page.getByLabel('QC outcome').selectOption('rework');
 await page.getByLabel('Defect category').selectOption('implant-interface');
 await page.getByLabel('Defect description').fill('Interface requires correction before final approval.');
 await page.getByLabel('QC notes').fill('Digital sign-off recorded after full inspection.');
 await page.getByRole('button',{name:'Digitally sign inspection'}).click();
 await expect(page.getByText(clinicalCase.caseNumber)).toBeVisible();
 await expect(page.getByText('rework',{exact:true})).toBeVisible();
 await expect(page.getByText('implant-interface: Interface requires correction before final approval.')).toBeVisible();
 await expect(page.getByText(/Dorian Habet · digitally-signed/)).toBeVisible();
 await page.getByLabel(`Attach QC photo to ${clinicalCase.caseNumber}`).setInputFiles({name:'qc-defect.jpg',mimeType:'image/jpeg',buffer:Buffer.from('sprint6-qc-photo')});
 await expect(page.getByText('qc-defect.jpg')).toBeVisible();
 await page.getByRole('button',{name:'Laboratory'}).click();
 await expect(page.getByText('QC rework rate')).toBeVisible();
 await expect(page.getByText('100%')).toBeVisible();
 await expect(page.getByText('implant interface')).toBeVisible();
});
