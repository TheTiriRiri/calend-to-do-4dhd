import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('onboarded', '1'));
  await page.reload();
});

async function addTaskScheduledToday(page: import('@playwright/test').Page, title: string, priority: 'A — dziś/jutro' | 'B — częściowo pilne' | 'C — może poczekać') {
  await page.goto('/#/lista');
  await page.getByRole('button', { name: 'Dodaj' }).click();
  await page.getByPlaceholder('Co jest do zrobienia?').fill(title);
  await page.getByRole('button', { name: priority }).click();
  await page.getByText(title).click();
  await page.getByLabel(/Dzień/).fill(new Date().toLocaleDateString('sv-SE'));
  await page.getByRole('button', { name: 'Zapisz' }).click();
  await expect(page.getByRole('button', { name: 'Zapisz' })).toBeHidden();
}

test('undo restores a completed task to its section', async ({ page }) => {
  await addTaskScheduledToday(page, 'Zadanie do cofnięcia', 'A — dziś/jutro');

  await page.goto('/');
  await page.getByRole('button', { name: 'oznacz jako zrobione' }).click();
  await expect(page.getByText('Zrobione dziś')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zadanie do cofnięcia' })).toBeHidden();

  await page.getByRole('button', { name: 'cofnij' }).click();
  await expect(page.getByRole('button', { name: 'Zadanie do cofnięcia' })).toBeVisible();
  await expect(page.getByText('Zrobione dziś')).toBeHidden();
});

test('completing a container step does not add the container to the done-today strip (C-1)', async ({ page }) => {
  await page.goto('/#/lista');
  await page.getByRole('button', { name: 'Dodaj' }).click();
  await page.getByPlaceholder('Co jest do zrobienia?').fill('Duży projekt do cofnięcia');
  await page.getByRole('button', { name: 'A — dziś/jutro' }).click();
  await page.getByText('Duży projekt do cofnięcia').click();
  await page.getByRole('button', { name: 'Podziel na kroki' }).click();
  await page.getByPlaceholder('Krok…').fill('Jedyny krok');
  await page.getByRole('button', { name: 'Zapisz' }).click();

  await page.getByRole('button', { name: 'Jedyny krok', exact: true }).click();
  await page.getByLabel(/Dzień/).fill(new Date().toLocaleDateString('sv-SE'));
  await page.getByRole('button', { name: 'Zapisz' }).click();
  await expect(page.getByRole('button', { name: 'Zapisz' })).toBeHidden();

  await page.goto('/');
  await page.getByRole('button', { name: 'oznacz jako zrobione' }).click();
  await expect(page.getByText('Zrobione dziś')).toBeVisible();
  // exactly one row (the step) — not two (step + the auto-completed container)
  await expect(page.locator('ul.muted li')).toHaveCount(1);
});

test('priority change via the editor moves the task to its new section', async ({ page }) => {
  await addTaskScheduledToday(page, 'Zmiana priorytetu', 'C — może poczekać');

  await page.goto('/#/lista');
  await page.getByText('Zmiana priorytetu').click();
  await page.getByRole('button', { name: 'B', exact: true }).click();
  await page.getByRole('button', { name: 'Zapisz' }).click();
  await expect(page.getByRole('button', { name: 'Zapisz' })).toBeHidden();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mniej pilne' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zmiana priorytetu' })).toBeVisible();
});

test('move to tomorrow removes a task from the active list', async ({ page }) => {
  await addTaskScheduledToday(page, 'Zadanie do przełożenia', 'A — dziś/jutro');

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Zadanie do przełożenia' })).toBeVisible();
  await page.getByRole('button', { name: 'Przełóż na jutro' }).click();
  await expect(page.getByRole('button', { name: 'Zadanie do przełożenia' })).toBeHidden();
});

test('a collapsed section shows a Polish-correct task count and expands on tap', async ({ page }) => {
  await addTaskScheduledToday(page, 'Pilne raz', 'A — dziś/jutro');
  await addTaskScheduledToday(page, 'Mniej pilne raz', 'B — częściowo pilne');
  await addTaskScheduledToday(page, 'Mniej pilne dwa', 'B — częściowo pilne');

  await page.goto('/');
  // B stays collapsed while A has active tasks (protocol: all A before B)
  const tile = page.getByRole('button', { name: '2 zadania' });
  await expect(tile).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mniej pilne raz' })).toBeHidden();

  await tile.click();
  await expect(page.getByRole('button', { name: 'Mniej pilne raz' })).toBeVisible();
});
