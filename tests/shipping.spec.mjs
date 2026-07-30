import { expect, test } from '@playwright/test';

const email='dorianhabet@yahoo.com';
const password='NorthStar!2026';
async function login(page){await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();await page.getByLabel('Email').fill(email);await page.getByLabel('Password').fill(password);await page.getByRole('button',{name:'Sign in'}).click();await expect(page.getByRole('heading',{name:'Laboratory Status'})).toBeVisible();}

test('QC approval to delivered shipment lifecycle',async({page,request})=>{
 await login(page);
 const patientResponse=await request.post('http://127.0.0.1:4000/api/patients',{data:{practiceId:'practice-1',doctorId:'doctor-1',patientReference:'SHIP-S7-001',firstName:'Logistics',lastName:'Patient',dateOfBirth:'1990-01-01',status:'active',notes:'Sprint 7 shipping patient'}});expect(patientResponse.ok()).toBeTruthy();const patient=await patientResponse.json();
 const caseResponse=await request.post('http://127.0.0.1:4000/api/cases',{data:{patientId:patient.id,practiceId:'practice-1',doctorId:'doctor-1',status:'qc',toothNumbers:[30],arch:'mandibular',restoration:'Implant Crown',material:'Zirconia',shade:'A2',stumpShade:'ND2',rushPriority:'standard',receivedDate:new Date().toISOString().slice(0,10),prescriptionNotes:'QC approval before shipment.'}});expect(caseResponse.ok()).toBeTruthy();const clinicalCase=await caseResponse.json();
 const templatesResponse=await request.get('http://127.0.0.1:4000/api/qc/templates?restoration=Implant%20Crown');const templates=await templatesResponse.json();const template=templates[0];
 const inspectionResponse=await request.post('http://127.0.0.1:4000/api/qc/inspections',{data:{caseId:clinicalCase.id,templateId:template.id,outcome:'pass',checklist:template.checklistItems.map(item=>({checklistItemId:item.id,label:item.label,result:'pass',note:'Verified',defectCategory:item.defectCategory})),defects:[],inspectorId:'usr-admin',inspectorName:'Dorian Habet',notes:'Approved for shipping.'}});expect(inspectionResponse.ok()).toBeTruthy();
 await page.getByRole('button',{name:'Shipping'}).click();await expect(page.getByRole('heading',{name:'Shipping & Logistics',level:1})).toBeVisible();
 await page.getByLabel(`Select ${clinicalCase.caseNumber}`).check();
 for(const label of ['Restoration verified against prescription','Case disinfected and protected','Models, components, and documentation included','Shipping address and doctor verified'])await page.getByLabel(label).check();
 await page.getByLabel('Courier').selectOption('fedex');await page.getByLabel('Courier name').fill('FedEx');await page.getByLabel('Tracking number').fill('TRACK-S7-001');await page.getByLabel('Shipping notes').fill('Multi-case capable shipment lifecycle verification.');await page.getByRole('button',{name:'Create shipment'}).click();
 await expect(page.getByText(/SHP-\d{6}-001/)).toBeVisible();await expect(page.getByText(/SHIP-SHP-/)).toBeVisible();
 await page.getByRole('button',{name:'Mark Awaiting Pickup'}).click();await expect(page.getByText(/Shipment moved to Awaiting Pickup/)).toBeVisible();
 await page.getByRole('button',{name:'Mark Shipped'}).click();await expect(page.getByText(/Shipment moved to Shipped/)).toBeVisible();
 await page.getByRole('button',{name:'Mark Delivered'}).click();await expect(page.getByText(/Shipment moved to Delivered/)).toBeVisible();
 await page.getByRole('button',{name:'Laboratory'}).click();await expect(page.getByText('Delivered')).toBeVisible();
 const deliveredCase=await request.get(`http://127.0.0.1:4000/api/cases/${clinicalCase.id}`);expect((await deliveredCase.json()).status).toBe('completed');
});
