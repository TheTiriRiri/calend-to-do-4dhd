import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Behaviour locks for the screens the 2a-2g / 3a-3e sweep will rewrite
// (MasterList, TaskEditor, BreakdownWizard, ProblemFormWizard, History,
// Settings, EventEditor, Onboarding). They assert what each screen DOES, never
// how it looks, so a restyle that keeps the behaviour keeps them green — and a
// restyle that quietly drops a rule turns one of them red on the spot.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('onboarded', '1'));
  await page.reload();
});

async function addTask(page: Page, title: string, priority = 'A — dziś/jutro') {
  await page.goto('/#/lista');
  await page.getByRole('button', { name: 'Dodaj', exact: true }).click();
  await page.getByPlaceholder('Co jest do zrobienia?').fill(title);
  await page.getByRole('button', { name: priority }).click();
  await expect(page.getByText(title)).toBeVisible();
}

async function breakIntoSteps(page: Page, titles: string[]) {
  const sheet = page.locator('.overlay .sheet');
  await page.getByRole('button', { name: 'Podziel na kroki' }).click();
  for (const [i, title] of titles.entries()) {
    if (i > 0) await sheet.getByRole('button', { name: 'Dodaj', exact: true }).click();
    await sheet.getByPlaceholder('Krok…').nth(i).fill(title);
  }
  await sheet.getByRole('button', { name: 'Zapisz' }).click();
  await expect(sheet).toBeHidden();
}

test('2a: a step lives under its container section, never as a second loose row', async ({ page }) => {
  await addTask(page, 'Projekt na kroki');
  await page.getByText('Projekt na kroki').click();
  await breakIntoSteps(page, ['Krok jeden', 'Krok dwa']);

  const section = page.locator('section.sheet').filter({ hasText: 'Projekt na kroki' });
  await expect(section.getByRole('button', { name: 'Krok jeden' })).toBeVisible();
  await expect(section.getByRole('button', { name: 'Krok dwa' })).toBeVisible();
  // I-1: the steps and the container must not also appear in the loose list
  await expect(page.locator('main > ul > li')).toHaveCount(0);
});

test('2c: clearing the day returns a task to the master list only', async ({ page }) => {
  await addTask(page, 'Zadanie bez daty');
  await page.getByText('Zadanie bez daty').click();
  await page.getByLabel(/Dzień/).fill(new Date().toLocaleDateString('sv-SE'));
  await page.getByRole('button', { name: 'Zapisz' }).click();
  await expect(page.getByRole('button', { name: 'Zapisz' })).toBeHidden();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Zadanie bez daty' })).toBeVisible();

  await page.goto('/#/lista');
  await page.getByText('Zadanie bez daty').click();
  await page.getByLabel(/Dzień/).fill('');
  await page.getByRole('button', { name: 'Zapisz' }).click();
  await expect(page.getByRole('button', { name: 'Zapisz' })).toBeHidden();

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Zadanie bez daty' })).toBeHidden();
  await page.goto('/#/lista');
  await expect(page.getByText('Zadanie bez daty')).toBeVisible();
});

test('2c: a category typed once is offered to the next task', async ({ page }) => {
  await addTask(page, 'Zadanie z kategorią');
  await page.getByText('Zadanie z kategorią').click();
  await page.getByPlaceholder('np. dom, praca').fill('dom');
  await page.getByRole('button', { name: 'Zapisz' }).click();

  await addTask(page, 'Drugie zadanie', 'B — częściowo pilne');
  await page.getByText('Drugie zadanie').click();
  await expect(page.locator('#category-options option[value="dom"]')).toHaveCount(1);
});

test('2c: deleting a container names the step count and takes the steps with it', async ({ page }) => {
  await addTask(page, 'Kontener do usunięcia');
  await page.getByText('Kontener do usunięcia').click();
  await breakIntoSteps(page, ['Krok jeden', 'Krok dwa']);

  await page.getByRole('button', { name: 'Kontener do usunięcia' }).click();
  // waitForEvent (not page.on) so the assertion cannot run before the handler:
  // the click resolves once the dialog is answered, which may be after page.on
  const dialogPromise = page.waitForEvent('dialog');
  const clicked = page.getByRole('button', { name: 'Usuń' }).click();
  const dialog = await dialogPromise;

  expect(dialog.message()).toBe('Usunąć zadanie wraz z 2 krokami?');
  await dialog.accept();
  await clicked;
  await expect(page.getByText('Kontener do usunięcia')).toBeHidden();
  await expect(page.getByText('Krok jeden')).toBeHidden();
});

test('2d: a second breakdown appends its step after the existing ones', async ({ page }) => {
  await addTask(page, 'Rosnący projekt');
  await page.getByText('Rosnący projekt').click();
  await breakIntoSteps(page, ['Krok jeden', 'Krok dwa']);

  await page.getByRole('button', { name: 'Rosnący projekt' }).click();
  await breakIntoSteps(page, ['Krok trzy']);

  // I-2: order inside a container is insertion order, so the new step goes last
  const section = page.locator('section.sheet').filter({ hasText: 'Rosnący projekt' });
  expect(await section.locator('li button').allInnerTexts()).toEqual(['Krok jeden', 'Krok dwa', 'Krok trzy']);
});

test('2d: saving a breakdown with no step text keeps the sheet open and says so', async ({ page }) => {
  await addTask(page, 'Projekt bez kroków');
  await page.getByText('Projekt bez kroków').click();
  const sheet = page.locator('.overlay .sheet');
  await page.getByRole('button', { name: 'Podziel na kroki' }).click();
  await sheet.getByRole('button', { name: 'Zapisz' }).click();

  await expect(sheet.getByText('Wpisz przynajmniej jeden krok.')).toBeVisible();
  await expect(sheet).toBeVisible();
});

test('2e: the wizard will not advance without a problem, then without a solution', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Problem w 5 krokach' }).click();
  const sheet = page.locator('.overlay .sheet');

  await expect(sheet.getByRole('button', { name: 'Dalej' })).toBeDisabled();
  await sheet.getByPlaceholder('Np. nie mogę się zdecydować…').fill('Nie wiem od czego zacząć.');
  await sheet.getByRole('button', { name: 'Dalej' }).click();

  await expect(sheet.getByRole('button', { name: 'Dalej' })).toBeDisabled();
  await sheet.getByPlaceholder('Rozwiązanie…').fill('Zacząć od najmniejszego kroku');
  await sheet.getByRole('button', { name: 'Dodaj', exact: true }).click();
  await expect(sheet.getByRole('button', { name: 'Dalej' })).toBeEnabled();
});

test('2e: rejecting the best-rated solution offers the runner-up', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Problem w 5 krokach' }).click();
  const sheet = page.locator('.overlay .sheet');

  await sheet.getByPlaceholder('Np. nie mogę się zdecydować…').fill('Problem do oceny.');
  await sheet.getByRole('button', { name: 'Dalej' }).click();
  for (const text of ['Rozwiązanie słabsze', 'Rozwiązanie lepsze']) {
    await sheet.getByPlaceholder('Rozwiązanie…').fill(text);
    await sheet.getByRole('button', { name: 'Dodaj', exact: true }).click();
  }
  await sheet.getByRole('button', { name: 'Dalej' }).click(); // 3: pros/cons
  await sheet.getByRole('button', { name: 'Dalej' }).click(); // 4: ratings
  await sheet.locator('input[type=range]').first().fill('3');
  await sheet.locator('input[type=range]').last().fill('9');
  await sheet.getByRole('button', { name: 'Dalej' }).click(); // 5: summary

  await expect(sheet.getByRole('heading', { name: 'Rozwiązanie lepsze (9/10)' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Wolę kolejne najwyżej oceniane' }).click();
  await expect(sheet.getByRole('heading', { name: 'Rozwiązanie słabsze (3/10)' })).toBeVisible();
  // the last candidate cannot be rejected any further
  await expect(sheet.getByRole('button', { name: 'Wolę kolejne najwyżej oceniane' })).toBeHidden();
});

test('2f: history counts what was completed, and keeps it', async ({ page }) => {
  const today = new Date().toLocaleDateString('sv-SE');
  const base = { priority: 'a', dateAdded: '2026-08-27T10:00:00.000Z', sortOrder: 0 };
  const backup = {
    schema: 1,
    exportedAt: '2026-08-27T10:00:00.000Z',
    tasks: [
      { id: 'h1', title: 'Zrobione wczoraj', dateCompleted: '2026-09-04T08:00:00.000Z', ...base },
      { id: 'h2', title: 'Zrobione dzisiaj', dateCompleted: `${today}T08:00:00.000Z`, ...base },
      { id: 'h3', title: 'Wciąż otwarte', ...base },
    ],
    categories: [],
    events: [],
    problemForms: [],
    solutions: [],
  };
  await page.goto('/#/ustawienia');
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('input[type=file]').setInputFiles({
    name: 'history.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByText('Wczytano kopię.')).toBeVisible();

  await page.goto('/#/historia');
  await expect(page.getByText('Tyle się udało: 2')).toBeVisible();
  await expect(page.getByText('Zrobione wczoraj')).toBeVisible();
  await expect(page.getByText('Wciąż otwarte')).toBeHidden();
});

test('2g: the review time survives a relaunch', async ({ page }) => {
  await page.goto('/#/ustawienia');
  await page.locator('input[type=time]').fill('07:30');
  await page.reload();
  await expect(page.locator('input[type=time]')).toHaveValue('07:30');
});

test('3d: an event cannot be saved with an end at or before its start', async ({ page }) => {
  await page.goto('/#/kalendarz');
  await page.getByRole('button', { name: 'Dodaj wydarzenie' }).click();
  const sheet = page.locator('.overlay .sheet');

  await sheet.getByPlaceholder('Np. wizyta u lekarza').fill('Wizyta');
  await expect(sheet.getByRole('button', { name: 'Zapisz' })).toBeEnabled();

  await sheet.getByLabel('Koniec').check();
  await sheet.locator('input[type=time]').last().fill('11:00'); // start is 12:00
  await expect(sheet.getByRole('button', { name: 'Zapisz' })).toBeDisabled();

  await sheet.locator('input[type=time]').last().fill('13:00');
  await expect(sheet.getByRole('button', { name: 'Zapisz' })).toBeEnabled();
});

test('3b: onboarding stores the review time it asked for', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.locator('input[type=time]').fill('06:45');
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByRole('button', { name: 'Zaczynam' }).click();

  await expect(page.getByRole('heading', { name: 'Przegląd dnia' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('reviewTime'))).toBe('06:45');
});
