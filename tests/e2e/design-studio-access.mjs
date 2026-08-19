import { expect } from '@playwright/test';

const password=process.env.NORTHSTAR_UAT_PASSWORD??'NorthStar!2026-UAT';

export async function openAuthorizedDesignStudio(page,email='cad.designer@keramos-uat.example'){
  await page.goto('/');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  const login=await page.evaluate(async({email,password})=>{const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});return response.status;},{email,password});
  expect(login).toBe(200);
  await page.goto('/design-studio.html');
  await expect(page.getByRole('heading',{name:'Production Viewer'})).toBeVisible();
}
