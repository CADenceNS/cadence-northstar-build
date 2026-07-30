import { expect, test } from '@playwright/test';

const email='dorianhabet@yahoo.com';
const password='NorthStar!2026';

async function login(page){await page.goto('/');await page.getByLabel('Email').fill(email);await page.getByLabel('Password').fill(password);const response=page.waitForResponse(item=>item.url().endsWith('/api/auth/login')&&item.request().method()==='POST');await page.getByRole('button',{name:'Sign in'}).click();expect((await response).status()).toBe(200);await expect(page.getByRole('heading',{name:'Laboratory Status'})).toBeVisible()}

test('manual digital and physical intake converge on mandatory prescription workflow',async({page})=>{
 await login(page);
 await page.getByRole('button',{name:'Digital Intake'}).click();
 await expect(page.getByRole('heading',{name:'Digital Intake Platform'})).toBeVisible();
 await page.getByLabel('Intake method').selectOption('manual-digital');
 await page.getByLabel('Source reference').fill(`email-${Date.now()}`);
 const createResponse=page.waitForResponse(item=>item.url().endsWith('/api/intake/submissions')&&item.request().method()==='POST');
 await page.getByRole('button',{name:'Create submission record'}).click();
 expect((await createResponse).status()).toBe(201);
 await expect(page.getByText('SMART DIGITAL PRESCRIPTION')).toBeVisible();
 await page.getByLabel('Digital prescription patient name').fill('Digital Intake Patient');
 const patientReference=page.getByLabel('Digital prescription patient reference');
 if(!(await patientReference.inputValue()))await patientReference.fill(`PAT-${Date.now()}`);
 await page.getByLabel('Restoration 1 category').selectOption('Fixed Restorations');
 await page.getByLabel('Restoration 1 type').selectOption('Crown');
 await page.getByLabel('Restoration 1 subtype').fill('Full Zirconia Crown');
 await page.getByLabel('Restoration 1 material').selectOption('Zirconia');
 await page.getByRole('checkbox',{name:'30',exact:true}).check();
 await page.getByLabel('Digital prescription production notes').fill('Verify occlusion and proximal contacts.');
 const prescriptionResponse=page.waitForResponse(item=>item.url().includes('/prescription')&&item.request().method()==='PUT');
 await page.getByRole('button',{name:'Complete Digital Prescription'}).click();
 expect((await prescriptionResponse).status()).toBe(200);
 const attachmentResponse=page.waitForResponse(item=>item.url().includes('/attachments')&&item.request().method()==='POST');
 await page.getByLabel('Digital intake attachment').setInputFiles({name:'upper.stl',mimeType:'model/stl',buffer:Buffer.from('solid upper')});
 expect((await attachmentResponse).status()).toBe(201);
 for(const [button,ending] of [['Validate','/validate'],['Resolve routing','/route'],['Resolve products','/resolve-products']] as const){const response=page.waitForResponse(item=>item.url().endsWith(ending)&&item.request().method()==='POST');await page.getByRole('button',{name:button}).click();expect((await response).status()).toBe(200)}
 await expect(page.getByText('complete',{exact:true})).toBeVisible();
 await expect(page.getByText(/internal|hybrid|outsourced/,{exact:true})).toBeVisible();
 await expect(page.getByText('1',{exact:true})).toBeVisible();
 const pdfResponse=page.waitForResponse(item=>item.url().includes('/prescription-pdf')&&item.request().method()==='POST');
 await page.getByRole('button',{name:'Production Copy PDF'}).click();
 expect((await pdfResponse).status()).toBe(201);
 await page.reload();
 await expect(page.getByRole('heading',{name:'Laboratory Status'})).toBeVisible();
 await page.getByRole('button',{name:'Digital Intake'}).click();
 await page.getByRole('button',{name:'Scanner Queue'}).click();
 await expect(page.getByText('manual-digital')).toBeVisible();
 await page.getByRole('button',{name:'New Digital Submission'}).click();
 await page.getByLabel('Intake method').selectOption('physical');
 await page.getByLabel('Source reference').fill(`walk-in-${Date.now()}`);
 const physicalResponse=page.waitForResponse(item=>item.url().endsWith('/api/intake/submissions')&&item.request().method()==='POST');
 await page.getByRole('button',{name:'Create submission record'}).click();
 expect((await physicalResponse).status()).toBe(201);
 await expect(page.getByText('SMART DIGITAL PRESCRIPTION')).toBeVisible();
 const premature=page.waitForResponse(item=>item.url().endsWith('/accept')&&item.request().method()==='POST');
 await page.getByRole('button',{name:'Accept and create case'}).click();
 expect((await premature).status()).toBe(409);
 await expect(page.getByRole('alert')).toContainText('Digital Prescription is required');
});

test('scanner provider abstraction distinguishes simulators from production adapters',async({page})=>{
 await login(page);
 const stamp=Date.now();
 const simulator=await page.request.post('/api/intake/providers',{data:{providerKey:`simulator-${stamp}`,displayName:'Scanner Simulator',providerType:'simulator',productionReady:false}});
 expect(simulator.status()).toBe(201);
 const production=await page.request.post('/api/intake/providers',{data:{providerKey:`official-${stamp}`,displayName:'Official Adapter Contract',providerType:'official-adapter',productionReady:true}});
 expect(production.status()).toBe(201);
 const providers=await page.request.get('/api/intake/providers');
 expect(providers.status()).toBe(200);
 const body=await providers.json();
 expect(body.some(item=>item.provider_key===`simulator-${stamp}`&&item.production_ready===false)).toBe(true);
 expect(body.some(item=>item.provider_key===`official-${stamp}`&&item.production_ready===true)).toBe(true);
 const automatic=await page.request.post('/api/intake/submissions',{data:{intakeMethod:'automatic-digital',providerKey:`official-${stamp}`,sourceReference:`scanner-case-${stamp}`}});
 expect(automatic.status()).toBe(201);
 const record=await automatic.json();
 expect(record.intake_method).toBe('automatic-digital');
 expect(record.status).toBe('prescription-required');
});

test('administrators manage Doctor preferences, routing, and pricing schedule foundations',async({page})=>{
 await login(page);
 await page.getByRole('button',{name:'Intake Administration'}).click();
 await expect(page.getByRole('heading',{name:'Digital Intake Administration'})).toBeVisible();
 await page.getByLabel('Preferred material').fill('Zirconia');
 await page.getByLabel('Preferred margin').fill('Chamfer');
 await page.getByLabel('Preferred contacts').fill('Normal');
 await page.getByLabel('Preferred occlusion').fill('Light');
 await page.getByLabel('Production preferences').fill('Return with printed model.');
 await page.getByLabel('Doctor preferred route').selectOption('hybrid');
 await page.getByLabel('Doctor outsourcing partner').fill('Hybrid Partner');
 const doctorResponse=page.waitForResponse(item=>item.url().endsWith('/api/intake/admin/doctor-preferences')&&item.request().method()==='POST');
 await page.getByRole('button',{name:'Save Doctor preferences'}).click();
 expect((await doctorResponse).status()).toBe(201);
 await expect(page.getByText('Doctor preference')).toBeVisible();
 await expect(page.getByText('v1')).toBeVisible();

 await page.getByLabel('Practice preferred route').selectOption('outsourced');
 await page.getByLabel('Practice outsourcing partner').fill('Partner Laboratory');
 const practiceResponse=page.waitForResponse(item=>item.url().includes('/api/intake/admin/practice-routing/')&&item.request().method()==='PUT');
 await page.getByRole('button',{name:'Save Practice routing'}).click();
 expect((await practiceResponse).status()).toBe(200);
 await expect(page.getByText('Practice routing')).toBeVisible();

 await page.getByLabel('Tenant preferred route').selectOption('internal');
 const tenantResponse=page.waitForResponse(item=>item.url().endsWith('/api/intake/admin/tenant-routing')&&item.request().method()==='PUT');
 await page.getByRole('button',{name:'Save tenant default'}).click();
 expect((await tenantResponse).status()).toBe(200);

 const scheduleName=`Contract Schedule ${Date.now()}`;
 await page.getByLabel('Pricing schedule type').selectOption('contract');
 await page.getByLabel('Pricing schedule name').fill(scheduleName);
 await page.getByLabel('Pricing schedule priority').fill('10');
 const scheduleResponse=page.waitForResponse(item=>item.url().endsWith('/api/intake/admin/pricing-schedules')&&item.request().method()==='POST');
 await page.getByRole('button',{name:'Create pricing schedule'}).click();
 expect((await scheduleResponse).status()).toBe(201);
 await expect(page.getByText(scheduleName)).toBeVisible();
 await expect(page.getByText('Schedules are managed here; pricing calculation remains owned by Billing.')).toBeVisible();
});
