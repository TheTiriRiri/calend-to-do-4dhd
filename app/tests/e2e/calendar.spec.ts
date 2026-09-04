import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('onboarded', '1'));
  await page.reload();
});

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
