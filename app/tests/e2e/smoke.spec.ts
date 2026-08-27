import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('onboarded', '1'));
  await page.reload();
});

test('quick-add puts a task on the master list', async ({ page }) => {
  await page.goto('/#/lista');
  await page.getByRole('button', { name: 'Dodaj' }).click();
  await page.getByPlaceholder('Co jest do zrobienia?').fill('Wyrzucić śmieci');
  await page.getByRole('button', { name: 'A — dziś/jutro' }).click();
  await expect(page.getByText('Wyrzucić śmieci')).toBeVisible();
});

test('five-step wizard end-to-end: chosen solution becomes a task', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Problem w 5 krokach' }).click();
  await page.getByPlaceholder('Np. nie mogę się zdecydować…').fill('Testowy problem');
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByPlaceholder('Rozwiązanie…').fill('Opcja 1');
  // scope to the wizard sheet — DailyList's own "Dodaj" stays in the DOM behind it
  await page.locator('.sheet').getByRole('button', { name: 'Dodaj' }).click();
  await page.getByRole('button', { name: 'Dalej' }).click(); // step 3 skippable
  await page.getByRole('button', { name: 'Dalej' }).click(); // step 4, default rating
  await page.getByRole('button', { name: 'Dalej' }).click(); // step 5
  await page.getByRole('button', { name: 'Wybieram to' }).click();
  await page.getByRole('button', { name: 'Dodaj jako zadanie' }).click();
  await page.goto('/#/lista');
  await expect(page.getByText('Opcja 1')).toBeVisible();
});

test('breakdown creates a tappable container with steps', async ({ page }) => {
  await page.goto('/#/lista');
  await page.getByRole('button', { name: 'Dodaj' }).click();
  await page.getByPlaceholder('Co jest do zrobienia?').fill('Duży projekt');
  await page.getByRole('button', { name: 'B — częściowo pilne' }).click();
  await page.getByText('Duży projekt').click();
  await page.getByRole('button', { name: 'Podziel na kroki' }).click();
  await page.getByPlaceholder('Krok…').fill('Pierwszy krok');
  await page.getByRole('button', { name: 'Zapisz' }).click();
  await expect(page.getByRole('heading', { name: 'Duży projekt' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pierwszy krok', exact: true })).toBeVisible();
});

test('scheduled task completes and lands in history', async ({ page }) => {
  await page.goto('/#/lista');
  await page.getByRole('button', { name: 'Dodaj' }).click();
  await page.getByPlaceholder('Co jest do zrobienia?').fill('Zadanie na dziś');
  await page.getByRole('button', { name: 'B — częściowo pilne' }).click();
  await page.getByText('Zadanie na dziś').click();
  await page.getByLabel(/Dzień/).fill(new Date().toLocaleDateString('sv-SE'));
  await page.getByRole('button', { name: 'Zapisz' }).click();
  // the sheet closes only after save()'s awaited db write resolves — navigating
  // earlier aborts the in-flight IndexedDB transaction and loses the schedule
  await expect(page.getByRole('button', { name: 'Zapisz' })).toBeHidden();
  await page.goto('/');
  // the review screen shows the task once, on the daily list (DayView is events-only there)
  await expect(page.getByRole('button', { name: 'Zadanie na dziś' })).toBeVisible();
  await page.getByRole('button', { name: 'oznacz jako zrobione' }).click();
  await expect(page.getByText('Zrobione dziś')).toBeVisible();
  await page.goto('/#/historia');
  await expect(page.getByText('Zadanie na dziś')).toBeVisible();
});
