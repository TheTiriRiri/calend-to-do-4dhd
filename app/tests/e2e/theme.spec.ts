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
