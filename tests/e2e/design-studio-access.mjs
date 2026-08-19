import { expect } from '@playwright/test';

const password=process.env.NORTHSTAR_UAT_PASSWORD??'NorthStar!2026-UAT';

export async function openAuthorizedDesignStudio(page,email='cad.designer@keramos-uat.example'){
  const login=await page.request.post('/api/auth/login',{data:{email,password}});
  expect(login.status()).toBe(200);
  await page.goto('/design-studio.html');
  await expect(page.getByRole('heading',{name:'Production Viewer'})).toBeVisible();
}
