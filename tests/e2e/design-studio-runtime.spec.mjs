import { expect, test } from '@playwright/test';
import { openAuthorizedDesignStudio } from './design-studio-access.mjs';

const asciiStl = (offset = 0) => `solid arch
facet normal 0 0 1
outer loop
vertex ${offset} 0 0
vertex ${offset + 10} 0 0
vertex ${offset} 10 0
endloop
endfacet
endsolid arch`;
const obj = `v 0 0 0\nv 8 0 0\nv 0 8 0\nf 1 2 3\n`;
const ply = `ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n0 0 0\n6 0 0\n0 6 0\n3 0 1 2\n`;

async function openStudio(page) {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await openAuthorizedDesignStudio(page);
  return errors;
}

async function importFiles(page, files) {
  await page.locator('input[type=file]').setInputFiles(files.map((file) => ({
    name: file.name,
    mimeType: file.mimeType ?? 'application/octet-stream',
    buffer: Buffer.from(file.content),
  })));
}

test('imports multiple STL OBJ and PLY artifacts and manages scene commands', async ({ page }) => {
  const errors = await openStudio(page);
  await importFiles(page, [
    { name: 'upper_arch.stl', content: asciiStl() },
    { name: 'lower_arch.obj', content: obj },
    { name: 'bite.ply', content: ply },
  ]);

  await expect(page.getByText('3 objects', { exact: true })).toBeVisible();
  await expect(page.getByText('Upper arch · STL · 0% transparent')).toBeVisible();
  await expect(page.getByText('Lower arch · OBJ · 0% transparent')).toBeVisible();
  await expect(page.getByText('Bite scan · PLY · 0% transparent')).toBeVisible();

  await page.getByText('upper_arch.stl').click();
  await expect(page.getByText('Object ID')).toBeVisible();
  await page.getByLabel('Hide upper_arch.stl').click();
  await expect(page.getByText('2 visible')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('3 visible')).toBeVisible();
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByText('2 visible')).toBeVisible();

  await page.getByRole('button', { name: 'Isolate lower_arch.obj' }).click();
  await expect(page.getByText('1 visible')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('2 visible')).toBeVisible();

  await page.getByRole('button', { name: 'Orthographic' }).click();
  await expect(page.getByText('orthographic', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('perspective', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('supports multi-selection, immutable duplicate detection and artifact deletion undo', async ({ page }) => {
  const errors = await openStudio(page);
  await importFiles(page, [
    { name: 'upper_arch.stl', content: asciiStl() },
    { name: 'lower_arch.stl', content: asciiStl(20) },
  ]);
  await page.getByText('upper_arch.stl').click();
  await page.getByText('lower_arch.stl').click({ modifiers: ['Control'] });
  await expect(page.locator('.scene-row.selected')).toHaveCount(2);

  await importFiles(page, [{ name: 'duplicate_upper.stl', content: asciiStl() }]);
  await expect(page.getByText(/Duplicate source detected/)).toBeVisible();
  await expect(page.getByText('2 objects', { exact: true })).toBeVisible();

  await page.getByText('lower_arch.stl').click();
  await page.getByRole('button', { name: 'Remove artifact' }).click();
  await expect(page.getByText('1 objects', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('2 objects', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('persists project scene, artifacts, camera and selection across reload', async ({ page }) => {
  const errors = await openStudio(page);
  await importFiles(page, [{ name: 'upper_arch.stl', content: asciiStl() }]);
  await page.getByText('upper_arch.stl').click();
  await page.getByLabel('Project name').fill('Persistence Validation');
  await page.getByRole('button', { name: 'Orthographic' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved · Schema v6')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('button', { name: /Persistence Validation/ }).click();
  await expect(page.getByText('1 objects', { exact: true })).toBeVisible();
  await expect(page.getByText('orthographic', { exact: true })).toBeVisible();
  await expect(page.locator('.scene-row.selected')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('creates and restores an auto-save recovery snapshot', async ({ page }) => {
  const errors = await openStudio(page);
  await importFiles(page, [{ name: 'recovery_upper.stl', content: asciiStl() }]);
  await expect(page.getByText(/Auto-saved/)).toBeVisible({ timeout: 5_000 });
  await page.reload();
  await expect(page.getByText('1 objects', { exact: true })).toBeVisible();
  await expect(page.getByText('Recovery snapshot available')).toBeVisible();
  expect(errors).toEqual([]);
});
