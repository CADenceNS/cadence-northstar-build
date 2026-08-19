import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { openAuthorizedDesignStudio } from './design-studio-access.mjs';

async function openStudio(page) {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await openAuthorizedDesignStudio(page);
  return errors;
}

async function importFiles(page, files) {
  await page.locator('input[type=file]').setInputFiles(files.map((file) => ({ name: file.name, mimeType: 'application/octet-stream', buffer: Buffer.from(file.content) })));
  await expect(page.getByText(`${files.length} objects`, { exact: true })).toBeVisible();
}

async function openRegistration(page) { await page.getByRole('button', { name: 'Register', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Scan Registration' })).toBeVisible(); }

test('registers actual mesh geometry, reviews metrics and overlays, and persists the transform graph', async ({ page }) => {
  const errors = await openStudio(page); const target = archPoints(17, 13); const known = { angle: 14, translation: [6.2, -3.4, 1.7] };
  await importFiles(page, [
    { name: 'upper-arch-mm.ply', content: ply(target, 'upper', 17, 13) },
    { name: 'full-bite-mm.ply', content: ply(target.map((point) => inverseZ(point, known)), 'bite', 17, 13) },
  ]);
  await openRegistration(page);
  await page.getByLabel('Registration source').selectOption({ label: 'full-bite-mm.ply' });
  await expect(page.getByLabel('Source scan role').locator('option')).toHaveCount(19);
  await page.getByLabel('Registration target').selectOption({ label: 'upper-arch-mm.ply' });
  await expect(page.getByText('units pass', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Register selected pair' }).click();
  await expect(page.locator('.registration-result.accepted')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel('Registration confidence measurements')).toContainText('RMS residual');
  await expect(page.getByLabel('Registration confidence measurements')).toContainText('Iterations');
  await expect(page.getByText('Source scan', { exact: false }).last()).toBeVisible();
  await expect(page.getByText('Target scan', { exact: false }).last()).toBeVisible();
  await expect(page.getByText('Correspondence samples', { exact: false })).toBeVisible();
  const fingerprint = await page.locator('.registration-result code').textContent(); expect(fingerprint).toMatch(/^[a-f0-9]{16}$/);

  await page.getByRole('button', { name: 'Before', exact: true }).click(); await page.getByRole('button', { name: 'After', exact: true }).click();
  await page.getByRole('button', { name: 'Accept registration' }).click(); await expect(page.getByRole('status')).toContainText('Registration accepted');
  await page.getByRole('button', { name: '+0.1 mm X' }).click(); await expect(page.getByText(/review · manually modified/)).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click(); await expect(page.getByRole('status')).toContainText('Undid last command');
  await page.getByRole('button', { name: 'Redo' }).click(); await expect(page.getByRole('status')).toContainText('Redid command');
  await page.getByRole('button', { name: 'Lock registration' }).click();
  await expect(page.getByRole('button', { name: 'Unlock registration' })).toBeVisible();
  await expect(page.getByText(/Auto-saved/)).toBeVisible({ timeout: 5_000 });
  await page.getByLabel('Translation X').fill('0.2'); await page.getByRole('button', { name: 'Apply numeric transform' }).click(); await expect(page.getByRole('status')).toContainText('Locked scan');
  await page.getByRole('button', { name: 'Unlock registration' }).click();
  await page.getByRole('button', { name: 'Local re-refinement' }).click(); await expect(page.locator('.registration-result.manual-review-required')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Accept registration' }).click();
  await page.getByRole('button', { name: 'AUTO ASSEMBLE CASE' }).click(); await expect(page.locator('.assembly-summary.accepted')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('CADENCE_DENTAL_XYZ_V1')).toBeVisible();
  await page.getByRole('button', { name: 'Generate immutable registration report' }).click(); await expect(page.getByText('Registration report', { exact: true })).toBeVisible();

  const json = await downloadText(page, 'JSON'); const csv = await downloadText(page, 'CSV'); const html = await downloadText(page, 'Print HTML');
  expect(JSON.parse(json).relationshipResults.length).toBeGreaterThan(0); expect(csv).toContain('rms_mm'); expect(html).toContain('does not assert clinical approval');

  await page.getByLabel('Project name').fill('Registered Case'); await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.reload(); await page.getByRole('button', { name: 'Open' }).click(); await page.getByRole('button', { name: /Registered Case/ }).click(); await openRegistration(page);
  await expect(page.locator('.assembly-summary.accepted')).toBeVisible(); await expect(page.getByText('Registration report', { exact: true })).toBeVisible(); await expect(page.getByText('CADENCE_DENTAL_XYZ_V1')).toBeVisible();
  expect(errors).toEqual([]);
});

test('auto assembles upper, lower and bite scans from geometry and persists dental XYZ through recovery', async ({ page }) => {
  const errors = await openStudio(page); const upper = archPoints(17, 13); const lowerTransform = { angle: 2, translation: [0.35, 0.2, -5.8] };
  await importFiles(page, [
    { name: 'upper-arch-mm.ply', content: ply(upper, 'upper-case', 17, 13) },
    { name: 'lower-arch-mm.ply', content: ply(upper.map((point) => inverseZ(point, lowerTransform)), 'lower-case', 17, 13) },
    { name: 'full-bite-mm.ply', content: ply(upper, 'bite-evidence', 17, 13) },
  ]);
  await openRegistration(page); await page.getByRole('button', { name: 'AUTO ASSEMBLE CASE' }).click();
  await expect(page.locator('.assembly-summary.accepted')).toBeVisible({ timeout: 30_000 }); await expect(page.locator('.assembly-summary')).toContainText('3 scans · 2 relationships');
  await expect(page.getByText('CADENCE_DENTAL_XYZ_V1')).toBeVisible(); await expect(page.getByText('+X patient left')).toBeVisible(); await expect(page.getByText('+Y posterior')).toBeVisible(); await expect(page.getByText('+Z superior')).toBeVisible();
  await expect(page.locator('.confidence-grid span').filter({ hasText: 'Bite agreement' })).toContainText('1.000');
  await page.getByRole('button', { name: 'Reverse anterior direction' }).click(); await page.getByRole('button', { name: 'Lock coordinate system' }).click();
  await page.getByRole('button', { name: 'Generate immutable registration report' }).click();
  await expect(page.getByText('Registration report', { exact: true })).toBeVisible(); await expect(page.getByText(/Auto-saved/)).toBeVisible({ timeout: 5_000 });
  await page.reload(); await expect(page.getByText('Recovery snapshot available')).toBeVisible(); await page.getByRole('button', { name: 'Recover' }).click(); await openRegistration(page);
  await expect(page.locator('.assembly-summary.accepted')).toBeVisible(); await expect(page.getByRole('button', { name: 'Unlock coordinate system' })).toBeVisible(); await expect(page.getByText('Registration report', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('refuses to fabricate occlusion when upper and lower scans have no bite evidence', async ({ page }) => {
  const errors = await openStudio(page); const upper = archPoints(15, 11);
  await importFiles(page, [
    { name: 'upper-arch-mm.ply', content: ply(upper, 'upper-no-bite', 15, 11) },
    { name: 'lower-arch-mm.ply', content: ply(upper.map((point) => inverseZ(point, { angle: 0, translation: [0, 0, -6] })), 'lower-no-bite', 15, 11) },
  ]);
  await openRegistration(page); await page.getByRole('button', { name: 'AUTO ASSEMBLE CASE' }).click();
  await expect(page.locator('.assembly-summary.review')).toBeVisible({ timeout: 10_000 }); await expect(page.locator('.assembly-summary')).toContainText('2 scans · 0 relationships');
  await expect(page.getByRole('status')).toContainText('Assembly review: 0 errors · 1 warnings');
  expect(errors).toEqual([]);
});

test('requires unit confirmation, remains responsive in a worker, and cancels long registration safely', async ({ page }) => {
  const errors = await openStudio(page); const target = archPoints(60, 45); const source = target.map((point) => inverseZ(point, { angle: 17, translation: [8, -5, 2] }));
  await importFiles(page, [
    { name: 'upper-arch.ply', content: ply(target, 'unknown-unit-target', 60, 45) },
    { name: 'preparation-arch.ply', content: ply(source, 'unknown-unit-source', 60, 45) },
  ]);
  await openRegistration(page); await page.getByLabel('Registration source').selectOption({ label: 'preparation-arch.ply' }); await page.getByLabel('Registration target').selectOption({ label: 'upper-arch.ply' });
  await page.getByRole('button', { name: 'Register selected pair' }).click(); await expect(page.locator('.scan-validation-grid article').filter({ hasText: 'Source preflight' })).toContainText('units confirmation-required');
  await page.getByLabel('Source units').selectOption('mm'); await page.getByRole('button', { name: 'Confirm source units' }).click();
  await page.getByLabel('Target units').selectOption('mm'); await page.getByRole('button', { name: 'Confirm target units' }).click();
  await page.getByRole('button', { name: 'Register selected pair' }).click(); await expect(page.getByRole('button', { name: 'Cancel registration' })).toBeEnabled();
  const frameDurationMs = await page.evaluate(() => new Promise((resolve) => { const startedAt = performance.now(); requestAnimationFrame(() => resolve(performance.now() - startedAt)); }));
  expect(frameDurationMs).toBeLessThan(250);
  await page.getByRole('button', { name: 'Cancel registration' }).click();
  await expect(page.locator('.registration-result.cancelled')).toBeVisible({ timeout: 30_000 }); await expect(page.getByLabel('Registration confidence measurements')).toContainText('not available');
  expect(errors).toEqual([]);
});

async function downloadText(page, buttonName) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: buttonName, exact: true }).click()]);
  return readFile(await download.path(), 'utf8');
}

function archPoints(columns, rows) {
  const points = [];
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const x = (column - (columns - 1) / 2) * 1.35; const y = row * 1.45 + 0.035 * x * x;
    const z = 0.24 * Math.sin(column * 0.71) + 0.17 * Math.cos(row * 0.63) + 0.012 * x * row + (column === 2 && row === 2 ? 0.8 : 0);
    points.push([x, y, z]);
  }
  Object.defineProperty(points, 'columns', { value: columns }); Object.defineProperty(points, 'rows', { value: rows }); return points;
}

function ply(points, marker, columns, rows) {
  const faces = [];
  for (let row = 0; row < rows - 1; row += 1) for (let column = 0; column < columns - 1; column += 1) { const a = row * columns + column, b = a + 1, c = a + columns, d = c + 1; faces.push([a, c, b], [b, c, d]); }
  return `ply\nformat ascii 1.0\ncomment ${marker}\nelement vertex ${points.length}\nproperty float x\nproperty float y\nproperty float z\nelement face ${faces.length}\nproperty list uchar int vertex_indices\nend_header\n${points.map((point) => point.map((value) => value.toFixed(8)).join(' ')).join('\n')}\n${faces.map((face) => `3 ${face.join(' ')}`).join('\n')}\n`;
}

function inverseZ(point, transform) {
  const radians = transform.angle * Math.PI / 180, cosine = Math.cos(radians), sine = Math.sin(radians); const x = point[0] - transform.translation[0], y = point[1] - transform.translation[1];
  const transformed = [cosine * x + sine * y, -sine * x + cosine * y, point[2] - transform.translation[2]];
  return transformed;
}
