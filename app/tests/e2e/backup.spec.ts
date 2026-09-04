import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('onboarded', '1'));
  await page.reload();
});

test('backup round trip: exported JSON contains the task, import replaces data', async ({ page }) => {
  // add a task via the UI
  await page.goto('/#/lista');
  await page.getByRole('button', { name: 'Dodaj' }).click();
  await page.getByPlaceholder('Co jest do zrobienia?').fill('Zadanie do kopii');
  await page.getByRole('button', { name: 'A — dziś/jutro' }).click();
  await expect(page.getByText('Zadanie do kopii')).toBeVisible();

  // export and assert the downloaded JSON parses and contains the task
  await page.goto('/#/ustawienia');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Eksportuj kopię (JSON)' }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile((await download.path())!, 'utf-8'));
  expect(exported.schema).toBe(1);
  expect(exported.tasks.some((t: { title: string }) => t.title === 'Zadanie do kopii')).toBe(true);

  // import a different backup — it replaces everything
  const replacement = {
    schema: 1,
    exportedAt: '2026-08-27T10:00:00.000Z',
    tasks: [{ id: 'imported-1', title: 'Zadanie z kopii', priority: 'b', dateAdded: '2026-08-27T10:00:00.000Z', sortOrder: 0 }],
    categories: [],
    events: [],
    problemForms: [],
    solutions: [],
  };
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('input[type=file]').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(replacement)),
  });
  await expect(page.getByText('Wczytano kopię.')).toBeVisible();
  await page.goto('/#/lista');
  await expect(page.getByText('Zadanie z kopii')).toBeVisible();
  await expect(page.getByText('Zadanie do kopii')).toBeHidden();
});

test('malformed import shows an error and leaves existing data intact', async ({ page }) => {
  await page.goto('/#/lista');
  await page.getByRole('button', { name: 'Dodaj' }).click();
  await page.getByPlaceholder('Co jest do zrobienia?').fill('Zadanie sprzed importu');
  await page.getByRole('button', { name: 'A — dziś/jutro' }).click();
  await expect(page.getByText('Zadanie sprzed importu')).toBeVisible();

  await page.goto('/#/ustawienia');
  const malformed = {
    schema: 1,
    exportedAt: '',
    tasks: [{ id: 't1' }], // missing title/priority/dateAdded — fails validateTables
    categories: [],
    events: [],
    problemForms: [],
    solutions: [],
  };
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('input[type=file]').setInputFiles({
    name: 'malformed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(malformed)),
  });
  await expect(page.getByText('Nie udało się wczytać pliku.')).toBeVisible();

  await page.goto('/#/lista');
  await expect(page.getByText('Zadanie sprzed importu')).toBeVisible();
});
