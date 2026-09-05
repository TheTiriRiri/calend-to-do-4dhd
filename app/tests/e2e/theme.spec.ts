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

test('the Industry token layer reaches the DOM', async ({ page }) => {
  const body = page.locator('body');
  await expect(body).toHaveCSS('background-color', 'rgb(242, 242, 243)');
  expect(await body.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Barlow');

  const accent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim());
  expect(accent).toBe('#5980a6');
});

test('the .sheet / .overlay selector contract survives the restyle', async ({ page }) => {
  // CLAUDE.md documents these as the scoping idiom for e2e; the redesign keeps
  // the class names and moves only the styling onto .blueprint
  await page.goto('/#/kalendarz');
  await page.locator('.sheet').first().waitFor();
  expect(await page.locator('.sheet').count()).toBeGreaterThan(0);
});

// The 2a-2g / 3a-3e sweep restyles every screen below one at a time, and
// theme.css is global — a scoped override written for one screen lands on the
// others. These two run the design's hard rules over every route so a regression
// surfaces on the commit that causes it, not at the end of the sweep.
const ROUTES = ['#/', '#/lista', '#/kalendarz', '#/historia', '#/ustawienia'];

// An empty app renders almost no shapes, so the loop below would pass on any
// stylesheet. One import gives every route its content: a container with steps,
// a loose task and a scheduled one, an event today, and a completed task.
async function seedEveryScreen(page: import('@playwright/test').Page) {
  const today = new Date().toLocaleDateString('sv-SE');
  const base = { dateAdded: '2026-08-27T10:00:00.000Z', sortOrder: 0 };
  const backup = {
    schema: 1,
    exportedAt: '2026-08-27T10:00:00.000Z',
    tasks: [
      { id: 'p1', title: 'Kontener', priority: 'a', ...base },
      { id: 's1', title: 'Krok pierwszy', priority: 'a', parentId: 'p1', scheduledDate: today, ...base },
      { id: 'l1', title: 'Luźne zadanie', priority: 'b', ...base },
      { id: 'l2', title: 'Zadanie na dziś', priority: 'c', scheduledDate: today, ...base },
      { id: 'd1', title: 'Zrobione zadanie', priority: 'a', dateCompleted: `${today}T08:00:00.000Z`, ...base },
    ],
    categories: [{ id: 'c1', name: 'dom' }],
    events: [{ id: 'e1', title: 'Wizyta', startsAt: `${today}T10:00:00.000Z` }],
    problemForms: [],
    solutions: [],
  };
  await page.goto('/#/ustawienia');
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('input[type=file]').setInputFiles({
    name: 'seed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByText('Wczytano kopię.')).toBeVisible();
}

for (const route of ROUTES) {
  test(`radius stays 0 on ${route}`, async ({ page }) => {
    await seedEveryScreen(page);
    await page.goto(`/${route}`);
    await page.locator('main').waitFor();
    const rounded = await page.evaluate(() =>
      [...document.querySelectorAll('main *')]
        .filter((el) => {
          const r = getComputedStyle(el).borderRadius;
          return r !== '' && r !== '0px';
        })
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`));
    expect(rounded).toEqual([]);
  });

  test(`no field triggers the iOS focus zoom on ${route}`, async ({ page }) => {
    await seedEveryScreen(page);
    await page.goto(`/${route}`);
    await page.locator('main').waitFor();
    // under 16px, iOS Safari zooms the page in on focus and never zooms back out
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('main input, main textarea, main select')]
        .map((el) => ({ tag: el.tagName.toLowerCase(), size: parseFloat(getComputedStyle(el).fontSize) }))
        .filter((f) => f.size < 16));
    expect(small).toEqual([]);
  });

  test(`every button is a 44px target on ${route}`, async ({ page }) => {
    await seedEveryScreen(page);
    await page.goto(`/${route}`);
    await page.locator('main').waitFor();
    // .undo is the one documented exception: a word inside a running sentence,
    // padded to ~40px of hit area while its line box stays 13px (DailyList.svelte)
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('main button:not(.undo)')]
        .filter((el) => el.checkVisibility())
        .map((el) => ({ label: el.textContent?.trim().slice(0, 20), ...el.getBoundingClientRect().toJSON() }))
        .filter((box) => box.width < 44 || box.height < 44));
    expect(small).toEqual([]);
  });
}

test('nothing on the review screen has rounded corners', async ({ page }) => {
  // seed one A task (renders an open .blueprint .section) and two B tasks
  // (collapsed behind a .tile, per the A-before-B rule) so the assertion
  // actually sees the shapes it claims to guard
  await addTaskScheduledToday(page, 'Zadanie A', 'A — dziś/jutro');
  await addTaskScheduledToday(page, 'Zadanie B raz', 'B — częściowo pilne');
  await addTaskScheduledToday(page, 'Zadanie B dwa', 'B — częściowo pilne');

  await page.goto('/');
  await expect(page.locator('.blueprint.section')).toBeVisible();
  await expect(page.locator('.tile')).toBeVisible();

  const radii = await page.evaluate(() =>
    [...document.querySelectorAll('main *')].map((el) => getComputedStyle(el).borderRadius));
  expect(radii.every((r) => r === '0px' || r === '')).toBe(true);
});
