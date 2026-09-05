import { test, expect } from '@playwright/test';
import { bypassOnboarding, localDay } from './utils';

test.beforeEach(({ page }) => bypassOnboarding(page));

test('event edit updates the calendar row', async ({ page }) => {
  await page.goto('/#/kalendarz');
  await page.getByRole('button', { name: 'Dodaj wydarzenie' }).click();
  await page.locator('.overlay .sheet').getByPlaceholder('Np. wizyta u lekarza').fill('Wizyta u lekarza');
  await page.locator('.overlay .sheet').getByRole('button', { name: 'Zapisz' }).click();
  await expect(page.getByRole('button', { name: 'Wizyta u lekarza' })).toBeVisible();

  await page.getByRole('button', { name: 'Wizyta u lekarza' }).click();
  await page.locator('.overlay .sheet').getByPlaceholder('Np. wizyta u lekarza').fill('Wizyta u dentysty');
  await page.locator('.overlay .sheet').getByRole('button', { name: 'Zapisz' }).click();
  await expect(page.getByRole('button', { name: 'Wizyta u dentysty' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Wizyta u lekarza', exact: true })).toBeHidden();
});

test('event delete removes it from the day', async ({ page }) => {
  await page.goto('/#/kalendarz');
  await page.getByRole('button', { name: 'Dodaj wydarzenie' }).click();
  await page.locator('.overlay .sheet').getByPlaceholder('Np. wizyta u lekarza').fill('Do usunięcia');
  await page.locator('.overlay .sheet').getByRole('button', { name: 'Zapisz' }).click();
  await expect(page.getByRole('button', { name: 'Do usunięcia' })).toBeVisible();

  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Do usunięcia' }).click();
  await page.locator('.overlay .sheet').getByRole('button', { name: 'Usuń' }).click();
  await expect(page.getByRole('button', { name: 'Do usunięcia' })).toBeHidden();
});

test('week navigation reveals events beyond the initial 7-day window (I-10)', async ({ page }) => {
  await page.goto('/#/kalendarz');
  await page.getByRole('button', { name: 'Dodaj wydarzenie' }).click();
  await page.locator('.overlay .sheet').getByPlaceholder('Np. wizyta u lekarza').fill('Wydarzenie za 10 dni');
  await page.locator('.overlay .sheet').getByLabel(/Dzień/).fill(localDay(10));
  await page.locator('.overlay .sheet').getByRole('button', { name: 'Zapisz' }).click();

  // outside the initial today..+6 window
  await expect(page.getByRole('button', { name: 'Wydarzenie za 10 dni' })).toBeHidden();

  await page.getByRole('button', { name: 'Następny tydzień' }).click();
  await expect(page.getByRole('button', { name: 'Wydarzenie za 10 dni' })).toBeVisible();

  await page.getByRole('button', { name: 'Poprzedni tydzień' }).click();
  await expect(page.getByRole('button', { name: 'Wydarzenie za 10 dni' })).toBeHidden();
});

test('the rest-of-day line belongs to the review screen only, never to the week view', async ({ page }) => {
  // every test starts on an empty DB; with no event today the tail row prints
  // emptyDay, not restFree — so create one first
  await page.goto('/#/kalendarz');
  await page.getByRole('button', { name: 'Dodaj wydarzenie' }).click();
  await page.locator('.overlay .sheet').getByPlaceholder('Np. wizyta u lekarza').fill('Wizyta');
  await page.locator('.overlay .sheet').getByRole('button', { name: 'Zapisz' }).click();
  await expect(page.getByRole('button', { name: 'Wizyta' })).toBeVisible();
  await expect(page.getByText('Reszta dnia jest wolna.')).toHaveCount(0);

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Wizyta' })).toBeVisible();
  await expect(page.getByText('Reszta dnia jest wolna.')).toHaveCount(1);
});

test('an empty day on the review screen closes the axis with the empty-day line, not the rest-of-day line', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.axis-tail')).toHaveText('Nic w kalendarzu. To też jest informacja.');
  await expect(page.getByText('Reszta dnia jest wolna.')).toHaveCount(0);
});
