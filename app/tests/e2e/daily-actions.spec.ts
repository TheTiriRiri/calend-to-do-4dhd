import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('onboarded', '1'));
  await page.reload();
});

async function addTaskScheduled(page: import('@playwright/test').Page, title: string, priority: 'A — dziś/jutro' | 'B — częściowo pilne' | 'C — może poczekać', daysAgo = 0) {
  const day = new Date();
  day.setDate(day.getDate() - daysAgo);
  await page.goto('/#/lista');
  await page.getByRole('button', { name: 'Dodaj' }).click();
  await page.getByPlaceholder('Co jest do zrobienia?').fill(title);
  await page.getByRole('button', { name: priority }).click();
  await page.getByText(title).click();
  await page.getByLabel(/Dzień/).fill(day.toLocaleDateString('sv-SE'));
  await page.getByRole('button', { name: 'Zapisz' }).click();
  await expect(page.getByRole('button', { name: 'Zapisz' })).toBeHidden();
}

test('undo restores a completed task to its section', async ({ page }) => {
  await addTaskScheduled(page, 'Zadanie do cofnięcia', 'A — dziś/jutro');

  await page.goto('/');
  await page.getByRole('button', { name: 'oznacz jako zrobione' }).click();
  await expect(page.getByText('Zrobione dziś')).toBeVisible();
  // exact: the undo button's accessible name is now "cofnij <title>" (a11y fix:
  // it must announce the task name, not just "cofnij") and would otherwise also
  // match this substring-based locator while it sits visible in the done list
  await expect(page.getByRole('button', { name: 'Zadanie do cofnięcia', exact: true })).toBeHidden();

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

test('a scheduled container never reaches the daily list — only its step does', async ({ page }) => {
  // A container carries no date once it is broken down, so the UI cannot produce
  // this state; a hand-edited or older backup can. activeTasks() filters
  // containers defensively and this is the only test that exercises that filter:
  // a container on the daily list would be an untickable row (its completion is
  // derived from its steps).
  const today = new Date().toLocaleDateString('sv-SE');
  const base = { priority: 'a', dateAdded: '2026-08-27T10:00:00.000Z', sortOrder: 0 };
  const backup = {
    schema: 1,
    exportedAt: '2026-08-27T10:00:00.000Z',
    tasks: [
      { id: 'parent-1', title: 'Kontener z datą', scheduledDate: today, ...base },
      { id: 'step-1', title: 'Krok kontenera', parentId: 'parent-1', scheduledDate: today, ...base },
    ],
    categories: [],
    events: [],
    problemForms: [],
    solutions: [],
  };
  await page.goto('/#/ustawienia');
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('input[type=file]').setInputFiles({
    name: 'container.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByText('Wczytano kopię.')).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Krok kontenera' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kontener z datą' })).toBeHidden();
});

test('priority change via the editor moves the task to its new section', async ({ page }) => {
  await addTaskScheduled(page, 'Zmiana priorytetu', 'C — może poczekać');

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
  await addTaskScheduled(page, 'Zadanie do przełożenia', 'A — dziś/jutro');

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Zadanie do przełożenia' })).toBeVisible();
  await page.getByRole('button', { name: 'Przełóż na jutro' }).click();
  await expect(page.getByRole('button', { name: 'Zadanie do przełożenia' })).toBeHidden();
});

test('completing the last A task opens B — collapsing counts active tasks, not done ones', async ({ page }) => {
  await addTaskScheduled(page, 'Jedyne pilne', 'A — dziś/jutro');
  await addTaskScheduled(page, 'Mniej pilne po A', 'B — częściowo pilne');

  await page.goto('/');
  await expect(page.getByRole('button', { name: '1 zadanie' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mniej pilne po A' })).toBeHidden();

  await page.getByRole('button', { name: 'oznacz jako zrobione' }).click();

  // the completed A stays visible in the done-today strip — if the collapse rule
  // ever counted it as non-empty, B would stay shut and the protocol's "all A
  // before B" would turn into "B never"
  await expect(page.getByText('Zrobione dziś')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mniej pilne' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mniej pilne po A' })).toBeVisible();
});

test('an expanded section closes again when new higher-priority work arrives', async ({ page }) => {
  await addTaskScheduled(page, 'Pilne istniejące', 'A — dziś/jutro');
  await addTaskScheduled(page, 'Mniej pilne otwarte', 'B — częściowo pilne');

  await page.goto('/');
  await page.getByRole('button', { name: '1 zadanie' }).click();
  await expect(page.getByRole('button', { name: 'Mniej pilne otwarte' })).toBeVisible();

  // a deliberate tap opens B, it does not switch the rule off for the session:
  // a new A means A comes first again
  await page.getByRole('button', { name: 'Dodaj zadanie' }).click();
  await page.locator('.overlay .sheet').getByPlaceholder('Co jest do zrobienia?').fill('Pilne nowe');
  await page.locator('.overlay .sheet').getByRole('button', { name: 'A — dziś/jutro' }).click();

  await expect(page.getByRole('button', { name: 'Mniej pilne otwarte' })).toBeHidden();
  await expect(page.getByRole('button', { name: '1 zadanie' })).toBeVisible();
});

test('a collapsed section shows a Polish-correct task count and expands on tap', async ({ page }) => {
  await addTaskScheduled(page, 'Pilne raz', 'A — dziś/jutro');
  await addTaskScheduled(page, 'Mniej pilne raz', 'B — częściowo pilne');
  await addTaskScheduled(page, 'Mniej pilne dwa', 'B — częściowo pilne');

  await page.goto('/');
  // B stays collapsed while A has active tasks (protocol: all A before B)
  const tile = page.getByRole('button', { name: '2 zadania' });
  await expect(tile).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mniej pilne raz' })).toBeHidden();

  await tile.click();
  await expect(page.getByRole('button', { name: 'Mniej pilne raz' })).toBeVisible();
});

test('a 4th active A task shows the overload hint, which clears once one is done', async ({ page }) => {
  const hint = page.locator('[data-priority="a"]').getByText('Sporo w A na dziś — część może zaczekać do jutra.');

  // 'Pranie' is dated two days back: it proves decision D-1 end to end (a rolled-over
  // A task counts) and asserts the "z wcześniejszych dni" badge, which had no e2e at
  // all until now — QA open item 2.1
  await addTaskScheduled(page, 'Pranie', 'A — dziś/jutro', 2);
  await addTaskScheduled(page, 'Kot', 'A — dziś/jutro');
  await addTaskScheduled(page, 'Rachunki', 'A — dziś/jutro');
  await page.goto('/');
  await expect(page.getByText('z wcześniejszych dni')).toBeVisible();
  await expect(hint).toBeHidden();

  await addTaskScheduled(page, 'Zakupy', 'A — dziś/jutro');
  await page.goto('/');
  await expect(hint).toBeVisible();

  await page.getByRole('button', { name: 'oznacz jako zrobione' }).first().click();
  await expect(hint).toBeHidden();
});
