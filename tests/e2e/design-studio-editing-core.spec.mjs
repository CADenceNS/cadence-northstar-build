import { expect, test } from '@playwright/test';

const cubePly = (offsetX = 0) => {
  const vertices = [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0], [0, 0, 10], [10, 0, 10], [10, 10, 10], [0, 10, 10]].map(([x, y, z]) => `${x + offsetX} ${y} ${z}`).join('\n');
  const faces = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]].map((face) => `3 ${face.join(' ')}`).join('\n');
  return `ply
format ascii 1.0
comment generated deterministic universal editing fixture
element vertex 8
property float x
property float y
property float z
element face 12
property list uchar int vertex_indices
end_header
${vertices}
${faces}
`;
};

async function openStudio(page) {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/design-studio.html');
  await expect(page.getByRole('heading', { name: 'Production Viewer' })).toBeVisible();
  return errors;
}

async function importCube(page, name, offset = 0) {
  await page.locator('input[type=file]').setInputFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(cubePly(offset)) });
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

async function clickCanvas(page, xRatio = 0.5, yRatio = 0.5) {
  const canvas = page.getByLabel('Design Studio 3D viewer'); const box = await canvas.boundingBox(); expect(box).not.toBeNull(); await canvas.click({ position: { x: box.width * xRatio, y: box.height * yRatio } });
}

async function previewAndConfirm(page) {
  await page.getByRole('button', { name: 'Preview actual geometry' }).click();
  await expect(page.getByRole('button', { name: 'Confirm derived version' })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Confirm derived version' }).click();
  await expect(page.getByRole('status')).toContainText('Derived geometry version committed', { timeout: 15_000 });
}

test('selects actual faces and commits an undoable derived extrusion', async ({ page }) => {
  const errors = await openStudio(page); await importCube(page, 'editing_cube.ply'); await page.getByText('editing_cube.ply', { exact: true }).click(); await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: /^Face/ }).click(); await clickCanvas(page); await expect(page.locator('.editing-selection-summary')).toContainText(/1 face|2 face/);
  await page.getByRole('button', { name: 'mesh', exact: true }).click(); await page.getByRole('button', { name: /Extrude faces/ }).click(); await page.getByLabel('Distance').fill('2');
  await previewAndConfirm(page); await expect(page.locator('.geometry-comparison')).toContainText('Mesh Extrude'); await expect(page.locator('.geometry-comparison')).toContainText(/Triangles 12 →/);
  await page.getByRole('button', { name: 'Undo' }).click(); await expect(page.locator('.geometry-comparison')).toHaveCount(0); await page.getByRole('button', { name: 'Redo' }).click(); await expect(page.locator('.geometry-comparison')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('performs numeric transform, bake, save/reopen, and crash recovery', async ({ page }) => {
  const errors = await openStudio(page); await importCube(page, 'transform_cube.ply'); await page.getByText('transform_cube.ply', { exact: true }).click(); await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'transform', exact: true }).click(); await page.getByRole('button', { name: /^Move/ }).click(); await page.getByLabel('X', { exact: true }).fill('4.25'); await page.getByRole('button', { name: 'Apply through command' }).click(); await expect(page.getByRole('status')).toContainText('transform.move applied'); await expect(page.getByLabel('Exact object transform')).toContainText('Position mm 4.250000');
  await page.getByRole('button', { name: /Apply\/bake transform/ }).click(); await previewAndConfirm(page); await expect(page.locator('.geometry-comparison')).toContainText('Transform Bake'); await expect(page.getByLabel('Exact object transform')).toContainText('Position mm 0.000000');
  await page.getByLabel('Project name').fill('Editing Persistence'); await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.getByText('Saved · Schema v4')).toBeVisible(); await page.getByRole('button', { name: 'Close' }).click(); await page.getByRole('button', { name: 'Open' }).click(); await page.getByRole('button', { name: /Editing Persistence/ }).click(); await page.getByRole('button', { name: 'Edit', exact: true }).click(); await expect(page.locator('.geometry-comparison')).toContainText('Transform Bake');
  await page.getByRole('button', { name: 'transform', exact: true }).click(); await page.getByRole('button', { name: /^Move/ }).click(); await page.getByLabel('X', { exact: true }).fill('1'); await page.getByRole('button', { name: 'Apply through command' }).click(); await expect(page.getByRole('status')).toContainText('Auto-saved', { timeout: 5_000 }); await page.reload(); await expect(page.getByText('Recovery snapshot available')).toBeVisible({ timeout: 5_000 }); await page.getByRole('button', { name: 'Recover' }).click(); await page.getByRole('button', { name: 'Edit', exact: true }).click(); await expect(page.locator('.geometry-comparison')).toContainText('Transform Bake');
  expect(errors).toEqual([]);
});

test('creates and persists a model-space surface curve through command history', async ({ page }) => {
  const errors = await openStudio(page); await importCube(page, 'curve_cube.ply'); await page.getByText('curve_cube.ply', { exact: true }).click(); await page.getByRole('button', { name: 'Edit', exact: true }).click(); await page.getByRole('button', { name: 'curve', exact: true }).click(); await page.getByRole('button', { name: /Surface-projected curve/ }).click();
  await clickCanvas(page, 0.45, 0.48); await clickCanvas(page, 0.5, 0.5); await clickCanvas(page, 0.55, 0.52); await page.getByRole('button', { name: 'Confirm curve' }).click(); await expect(page.locator('.curve-list')).toContainText('surface-projected');
  await page.getByRole('button', { name: 'Undo' }).click(); await expect(page.locator('.curve-list')).toHaveCount(0); await page.getByRole('button', { name: 'Redo' }).click(); await expect(page.locator('.curve-list')).toContainText('surface-projected');
  await page.getByRole('button', { name: /Edit control point/ }).click(); await page.getByLabel('Control X').fill('1.25'); await page.getByRole('button', { name: 'Apply through command' }).click(); await expect(page.getByRole('status')).toContainText('curve.edit-point completed');
  await page.getByLabel('Project name').fill('Curve Persistence'); await page.getByRole('button', { name: 'Save', exact: true }).click(); const savedCurve = await page.evaluate(() => { const key = Object.keys(localStorage).find((value) => value.startsWith('cadence.design-studio.project.')); const curve = JSON.parse(localStorage.getItem(key)).editing.curves[0]; return { objectId: curve.objectId, artifactId: curve.artifactId, first: curve.controlPoints[0] }; }); expect(savedCurve.objectId).toBeTruthy(); expect(savedCurve.artifactId).toBeTruthy(); expect(savedCurve.first[0]).toBeCloseTo(1.25, 5); await page.reload(); await page.getByRole('button', { name: 'Open' }).click(); await page.getByRole('button', { name: /Curve Persistence/ }).click(); await page.getByRole('button', { name: 'Edit', exact: true }).click(); await expect(page.locator('.curve-list')).toContainText(/(?:[2-9]|\d{2,}) controls/); expect(errors).toEqual([]);
});

test('previews and commits validated Boolean geometry while the main frame loop remains responsive', async ({ page }) => {
  const errors = await openStudio(page); await importCube(page, 'boolean_a.ply'); await importCube(page, 'boolean_b.ply', 5); await page.getByText('boolean_a.ply', { exact: true }).click(); await page.getByText('boolean_b.ply', { exact: true }).click({ modifiers: ['Control'] }); await expect(page.locator('.scene-row.selected')).toHaveCount(2); await page.getByRole('button', { name: 'Edit', exact: true }).click(); await page.getByRole('button', { name: 'boolean', exact: true }).click(); await page.getByRole('button', { name: /Boolean union/ }).click();
  await page.evaluate(() => { window.__editingFrameProbe = { active: true, frames: 0, maxGapMs: 0, last: performance.now() }; const tick = (time) => { const probe = window.__editingFrameProbe; if (!probe?.active) return; probe.frames += 1; probe.maxGapMs = Math.max(probe.maxGapMs, time - probe.last); probe.last = time; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await previewAndConfirm(page); const probe = await page.evaluate(() => { window.__editingFrameProbe.active = false; return window.__editingFrameProbe; }); console.log('EDITING_BROWSER_PERFORMANCE', JSON.stringify(probe)); expect(probe.frames).toBeGreaterThan(0); await expect(page.locator('.geometry-comparison')).toContainText('Boolean Union'); await expect(page.locator('.geometry-comparison')).toContainText('Non-manifold 0 → 0'); expect(errors).toEqual([]);
});

test('plane-cuts actual geometry with a validated derived second part', async ({ page }) => {
  const errors = await openStudio(page); await importCube(page, 'cut_cube.ply'); await page.getByText('cut_cube.ply', { exact: true }).click(); await page.getByRole('button', { name: 'Edit', exact: true }).click(); await page.getByRole('button', { name: 'cut', exact: true }).click(); await page.getByRole('button', { name: /^Plane cut/ }).click();
  await page.getByLabel('Origin X').fill('5'); await page.getByLabel('Normal X').fill('1'); await page.getByLabel('Normal Z').fill('0'); await previewAndConfirm(page);
  await expect(page.locator('.geometry-comparison')).toContainText('Cut Plane'); await expect(page.locator('.geometry-comparison')).toContainText('Watertight true → true'); await expect(page.locator('.scene-row')).toHaveCount(2); expect(errors).toEqual([]);
});

test('subdivides actual topology and reports persisted triangle quality', async ({ page }) => {
  const errors = await openStudio(page); await importCube(page, 'topology_cube.ply'); await page.getByText('topology_cube.ply', { exact: true }).click(); await page.getByRole('button', { name: 'Edit', exact: true }).click(); await page.getByRole('button', { name: 'topology', exact: true }).click(); await page.getByRole('button', { name: /^Subdivide/ }).click(); await page.getByLabel('Levels').fill('1'); await previewAndConfirm(page);
  await expect(page.locator('.geometry-comparison')).toContainText('Triangles 12 → 48'); await expect(page.locator('.geometry-comparison')).toContainText('Minimum angle'); await page.getByLabel('Project name').fill('Topology Quality Persistence'); await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.reload(); await page.getByRole('button', { name: 'Open' }).click(); await page.getByRole('button', { name: /Topology Quality Persistence/ }).click(); await page.getByRole('button', { name: 'Edit', exact: true }).click(); await expect(page.locator('.geometry-comparison')).toContainText('Low-quality triangles'); expect(errors).toEqual([]);
});
