import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { bypassOnboarding } from './utils';

test.beforeEach(({ page }) => bypassOnboarding(page));

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

test('an import that fails INSIDE the transaction rolls back — the old data survives', async ({ page }) => {
  // The malformed-import test below fails in deserialize(), before a single row is
  // touched. This one passes validateTables and blows up in the middle of the
  // import transaction, after all five tables were cleared — the only path that
  // can wipe the device. Rollback is Dexie's, but it is what stands between a bad
  // file and total data loss, so it gets its own test.
  await page.goto('/#/lista');
  await page.getByRole('button', { name: 'Dodaj' }).click();
  await page.getByPlaceholder('Co jest do zrobienia?').fill('Zadanie sprzed rollbacku');
  await page.getByRole('button', { name: 'A — dziś/jutro' }).click();
  await expect(page.getByText('Zadanie sprzed rollbacku')).toBeVisible();

  await page.goto('/#/ustawienia');
  const row = { title: 'Z pliku', priority: 'a', dateAdded: '2026-08-27T10:00:00.000Z', sortOrder: 0 };
  const duplicateIds = {
    schema: 1,
    exportedAt: '2026-08-27T10:00:00.000Z',
    // both rows are individually valid — the second one collides on the primary key
    tasks: [{ id: 'dup-1', ...row }, { id: 'dup-1', ...row }],
    categories: [],
    events: [],
    problemForms: [],
    solutions: [],
  };
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('input[type=file]').setInputFiles({
    name: 'duplicate-ids.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(duplicateIds)),
  });
  await expect(page.getByText('Nie udało się wczytać pliku.')).toBeVisible();

  await page.goto('/#/lista');
  await expect(page.getByText('Zadanie sprzed rollbacku')).toBeVisible();
  await expect(page.getByText('Z pliku')).toBeHidden();
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
