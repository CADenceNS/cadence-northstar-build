import { expect, test } from '@playwright/test';

const trianglePly = (offset = 0) => `ply
format ascii 1.0
comment generated deterministic inspection fixture
element vertex 3
property float x
property float y
property float z
element face 1
property list uchar int vertex_indices
end_header
${offset} 0 0
${offset + 2} 0 0
${offset} 2 0
3 0 1 2
`;

async function openStudio(page) {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/design-studio.html');
  await expect(page.getByRole('heading', { name: 'Production Viewer' })).toBeVisible();
  return errors;
}

async function importPly(page, name, offset = 0) {
  await page.locator('input[type=file]').setInputFiles({
    name,
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(trianglePly(offset)),
  });
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

async function acceptPrompt(page, value, action) {
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('prompt');
    await dialog.accept(value);
  });
  await action();
}

test('operates and persists the production scene tree and dental navigation workspace', async ({ page }) => {
  const errors = await openStudio(page);
  await importPly(page, 'upper_arch.ply');
  await importPly(page, 'lower_arch.ply', 5);

  const upper = page.locator('.scene-row').filter({ hasText: 'upper_arch.ply' });
  const lower = page.locator('.scene-row').filter({ hasText: 'lower_arch.ply' });
  await upper.click();
  await acceptPrompt(page, 'Prepared Unit', () => page.getByRole('button', { name: 'Rename', exact: true }).click());
  await expect(page.getByText('Prepared Unit', { exact: true })).toBeVisible();
  const prepared = page.locator('.scene-row').filter({ hasText: 'Prepared Unit' });
  await page.getByLabel('Dental role').selectOption('preparation');
  await expect(prepared).toContainText('Preparation');

  await page.getByLabel('Transparency percent').fill('40');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('.range-action')).toContainText('40% transparent');
  await expect(prepared).toContainText('40% transparent');
  await page.getByRole('button', { name: 'Reset transparency' }).click();
  await expect(prepared).toContainText('0% transparent');

  await page.getByLabel('Lock Prepared Unit').click();
  await page.getByRole('button', { name: 'Remove artifact' }).click();
  await expect(page.getByRole('status')).toContainText('Locked object Prepared Unit cannot be deleted');
  await expect(page.getByText('2 objects', { exact: true })).toBeVisible();
  await page.getByLabel('Unlock Prepared Unit').click();

  await lower.click({ modifiers: ['Control'] });
  await expect(page.locator('.scene-row.selected')).toHaveCount(2);
  await page.getByRole('button', { name: 'Fit selected', exact: true }).first().click();
  await expect(page.getByRole('status')).toContainText('Fit selected');
  await page.getByLabel('Dental camera preset').selectOption('occlusal');
  await page.getByRole('button', { name: 'Orthographic' }).click();
  await expect(page.getByRole('status').getByText('orthographic', { exact: true })).toBeVisible();

  await acceptPrompt(page, 'Occlusal Review', () => page.getByRole('button', { name: 'Save view' }).click());
  await expect(page.getByText('Occlusal Review', { exact: true })).toBeVisible();
  await acceptPrompt(page, 'Occlusal QA', () => page.getByLabel('Rename view Occlusal Review').click());
  await expect(page.getByText('Occlusal QA', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Occlusal QA orthographic', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Restored Occlusal QA');

  await page.getByLabel('Project name').fill('Scene Navigation Persistence');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('button', { name: /Scene Navigation Persistence/ }).click();
  await expect(page.getByText('2 objects', { exact: true })).toBeVisible();
  await expect(page.getByText('Prepared Unit', { exact: true })).toBeVisible();
  await expect(page.getByText('Occlusal QA', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').getByText('orthographic', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('calculates geometry-backed measurements with history and project persistence', async ({ page }) => {
  const errors = await openStudio(page);
  await importPly(page, 'upper_measure.ply');
  await importPly(page, 'lower_measure.ply', 5);

  const upper = page.locator('.scene-row').filter({ hasText: 'upper_measure.ply' });
  const lower = page.locator('.scene-row').filter({ hasText: 'lower_measure.ply' });
  await upper.click();
  await lower.click({ modifiers: ['Control'] });
  await page.getByRole('button', { name: 'Measure', exact: true }).click();
  await page.getByRole('button', { name: 'Minimum object distance' }).click();
  await expect(page.locator('.measurement-list')).toContainText('3.00 mm');
  await expect(page.locator('.measurement-list')).toContainText('2 object associations');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.measurement-list article')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.locator('.measurement-list article')).toHaveCount(1);

  await upper.click();
  await page.getByRole('button', { name: 'Object bounding dimensions' }).click();
  await expect(page.locator('.measurement-list')).toContainText('2.00 × 2.00 × 0.00 mm');
  const bounding = page.locator('.measurement-list article').filter({ hasText: 'Object bounding dimensions' });
  await bounding.click();
  await page.getByLabel('Decimal precision').selectOption('3');
  await expect(bounding).toContainText('2.000 × 2.000 × 0.000 mm');
  await page.getByLabel('Hide measurement Object bounding dimensions').click();
  await expect(page.getByLabel('Show measurement Object bounding dimensions')).toBeVisible();

  await page.getByLabel('Project name').fill('Measurement Persistence');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('button', { name: /Measurement Persistence/ }).click();
  await page.getByRole('button', { name: 'Measure', exact: true }).click();
  await expect(page.locator('.measurement-list article')).toHaveCount(2);
  await expect(page.getByLabel('Show measurement Object bounding dimensions')).toBeVisible();
  expect(errors).toEqual([]);
});

test('validates actual mesh topology, visualizes defects, and exports immutable reports', async ({ page }) => {
  const errors = await openStudio(page);
  await importPly(page, 'open_reference.ply');
  await page.getByText('open_reference.ply', { exact: true }).click();
  await page.getByRole('button', { name: 'Validate', exact: true }).click();
  await page.evaluate(() => {
    window.__sprint21FrameProbe = { active: true, frames: 0, maxGapMs: 0, last: performance.now() };
    const tick = (time) => {
      const probe = window.__sprint21FrameProbe;
      if (!probe?.active) return;
      probe.frames += 1;
      probe.maxGapMs = Math.max(probe.maxGapMs, time - probe.last);
      probe.last = time;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.getByRole('button', { name: 'Run validation' }).click();
  await expect(page.locator('.validation-summary')).toContainText('FAIL');
  const frameProbe = await page.evaluate(() => {
    window.__sprint21FrameProbe.active = false;
    return window.__sprint21FrameProbe;
  });
  console.log('BROWSER_PERFORMANCE', JSON.stringify({ case: 'worker-validation-responsiveness', ...frameProbe }));
  expect(frameProbe.frames).toBeGreaterThan(0);
  const frameMetric = page.getByLabel('Runtime performance metrics').locator('code').nth(4);
  await expect(frameMetric).toContainText('ms');
  const boundary = page.locator('.validation-results article').filter({ hasText: 'boundary-edges' });
  await expect(boundary).toContainText('Affected: 3');
  await expect(boundary).toContainText('overlay (3)');
  await boundary.click();
  await boundary.getByRole('button', { name: 'Zoom' }).click();

  await page.getByRole('button', { name: 'Re-run validation' }).click();
  await expect(page.locator('.comparison-card')).toContainText('Deterministic result unchanged');
  await page.getByRole('button', { name: 'Clear overlays' }).click();
  await expect(boundary.locator('input[type=checkbox]')).not.toBeChecked();

  await page.getByRole('button', { name: 'Generate immutable report' }).click();
  await expect(page.locator('.report-list article')).toHaveCount(1);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('.report-list').getByRole('button', { name: 'JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/open_reference\.ply-validation-.*\.json/);
  const path = await download.path();
  expect(path).not.toBeNull();
  const report = JSON.parse(await (await import('node:fs/promises')).readFile(path, 'utf8'));
  expect(report.artifactId).toBeTruthy();
  expect(report.fileHash).toMatch(/^[a-f0-9]{64}$/);
  expect(report.engineVersion).toBe('1.0.0');
  expect(report.overall).toBe('fail');
  expect(report.checks.find((check) => check.id === 'boundary-edges').affectedCount).toBe(3);
  expect(report).not.toHaveProperty('clinicalApproval');
  expect(report).not.toHaveProperty('manufacturingApproval');

  await page.getByLabel('Project name').fill('Validation Report Persistence');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('button', { name: /Validation Report Persistence/ }).click();
  await page.getByRole('button', { name: 'Validate', exact: true }).click();
  await expect(page.locator('.report-list article')).toHaveCount(1);
  expect(errors).toEqual([]);
});
